import { GraphQLError } from 'graphql';
import { prisma } from './prisma.js';
import { hashPassword, comparePassword, generateToken, isAdmin } from './auth.js';
import { PubSub } from 'graphql-subscriptions';

const updateSearchVector = async (postId) => {
  await prisma.$executeRaw`
    UPDATE "Post"
    SET "searchVector" = to_tsvector('english', "title" || ' ' || "content" || ' ' || array_to_string("tags", ' '))
    WHERE id = ${postId}
  `;
};

const pubsub = new PubSub();
const NEW_COMMENT = 'NEW_COMMENT';
const COMMENT_REVIEWED = 'COMMENT_REVIEWED';

const authenticate = (user) => {
  if (!user) throw new GraphQLError('Not authenticated');
};

export const resolvers = {
  Query: {
    me: async (_, __, { user }) => {
      authenticate(user);
      return user;
    },

    posts: async (_, { status }, { user }) => {
      const where = {};
      if (status) {
        where.status = status;
      } else if (!user || !isAdmin(user)) {
        where.status = 'PUBLISHED';
      }
      return prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
    },

    post: async (_, { id }, { user }) => {
      const post = await prisma.post.findUnique({ where: { id } });
      if (!post) return null;
      
      if (post.status === 'PUBLISHED') return post;
      if (user && (user.id === post.authorId || isAdmin(user))) return post;
      
      throw new GraphQLError('Not authorized');
    },

    myPosts: async (_, __, { user }) => {
      authenticate(user);
      return prisma.post.findMany({
        where: { authorId: user.id },
        orderBy: { createdAt: 'desc' },
      });
    },

    pendingComments: async (_, __, { user }) => {
      authenticate(user);
      if (!isAdmin(user)) throw new GraphQLError('Not authorized');
      return prisma.comment.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
    },

    postVersions: async (_, { postId }, { user }) => {
      authenticate(user);
      const post = await prisma.post.findUnique({ where: { id: postId } });
      if (!post) throw new GraphQLError('Post not found');
      if (user.id !== post.authorId && !isAdmin(user)) {
        throw new GraphQLError('Not authorized');
      }
      return prisma.postVersion.findMany({
        where: { postId },
        orderBy: { version: 'desc' },
      });
    },

    searchPosts: async (_, { query }, { user }) => {
      const where = { status: 'PUBLISHED' };
      
      if (user && isAdmin(user)) {
        delete where.status;
      }

      const results = await prisma.$queryRaw`
        SELECT p.*, ts_rank(p."searchVector", plainto_tsquery('english', ${query})) as rank
        FROM "Post" p
        WHERE p."searchVector" @@ plainto_tsquery('english', ${query})
        ${user && isAdmin(user) ? prisma.raw('') : prisma.raw('AND p.status = \'PUBLISHED\'')}
        ORDER BY rank DESC
        LIMIT 50
      `;

      const posts = results.map(r => ({
        id: r.id,
        title: r.title,
        content: r.content,
        tags: r.tags,
        status: r.status,
        scheduledPublishAt: r.scheduledPublishAt,
        authorId: r.authorId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      return {
        posts,
        total: posts.length,
      };
    },
  },

  Mutation: {
    register: async (_, { email, password, name }) => {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw new GraphQLError('Email already exists');
      
      const hashedPassword = await hashPassword(password);
      const user = await prisma.user.create({
        data: { email, password: hashedPassword, name },
      });
      
      return { token: generateToken(user), user };
    },

    login: async (_, { email, password }) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) throw new GraphQLError('Invalid credentials');
      
      const valid = await comparePassword(password, user.password);
      if (!valid) throw new GraphQLError('Invalid credentials');
      
      return { token: generateToken(user), user };
    },

    createPost: async (_, { title, content, tags, scheduledPublishAt }, { user }) => {
      authenticate(user);
      
      const scheduledAt = scheduledPublishAt ? new Date(scheduledPublishAt) : null;
      if (scheduledAt && scheduledAt <= new Date()) {
        throw new GraphQLError('Scheduled publish time must be in the future');
      }

      const post = await prisma.post.create({
        data: {
          title,
          content,
          tags,
          authorId: user.id,
          scheduledPublishAt: scheduledAt,
        },
      });

      await updateSearchVector(post.id);
      return post;
    },

    updatePost: async (_, { id, title, content, tags, scheduledPublishAt }, { user }) => {
      authenticate(user);
      const post = await prisma.post.findUnique({ where: { id } });
      if (!post) throw new GraphQLError('Post not found');
      if (post.authorId !== user.id && !isAdmin(user)) {
        throw new GraphQLError('Not authorized');
      }

      const scheduledAt = scheduledPublishAt !== undefined ? (scheduledPublishAt ? new Date(scheduledPublishAt) : null) : undefined;
      if (scheduledAt && scheduledAt <= new Date()) {
        throw new GraphQLError('Scheduled publish time must be in the future');
      }

      const lastVersion = await prisma.postVersion.findFirst({
        where: { postId: id },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (lastVersion?.version || 0) + 1;

      await prisma.postVersion.create({
        data: {
          postId: id,
          title: post.title,
          content: post.content,
          tags: post.tags,
          version: nextVersion,
        },
      });

      const updateData = { title, content, tags };
      if (scheduledAt !== undefined) {
        updateData.scheduledPublishAt = scheduledAt;
      }

      const updatedPost = await prisma.post.update({
        where: { id },
        data: updateData,
      });

      await updateSearchVector(id);
      return updatedPost;
    },

    deletePost: async (_, { id }, { user }) => {
      authenticate(user);
      const post = await prisma.post.findUnique({ where: { id } });
      if (!post) throw new GraphQLError('Post not found');
      if (post.authorId !== user.id && !isAdmin(user)) {
        throw new GraphQLError('Not authorized');
      }

      await prisma.comment.deleteMany({ where: { postId: id } });
      await prisma.postVersion.deleteMany({ where: { postId: id } });
      await prisma.post.delete({ where: { id } });
      return true;
    },

    submitForReview: async (_, { id }, { user }) => {
      authenticate(user);
      const post = await prisma.post.findUnique({ where: { id } });
      if (!post) throw new GraphQLError('Post not found');
      if (post.authorId !== user.id) {
        throw new GraphQLError('Not authorized');
      }
      return prisma.post.update({
        where: { id },
        data: { status: 'PENDING_REVIEW' },
      });
    },

    reviewPost: async (_, { id, status }, { user }) => {
      authenticate(user);
      if (!isAdmin(user)) throw new GraphQLError('Not authorized');
      if (status !== 'PUBLISHED' && status !== 'DRAFT') {
        throw new GraphQLError('Invalid status');
      }
      return prisma.post.update({ where: { id }, data: { status } });
    },

    schedulePost: async (_, { id, scheduledPublishAt }, { user }) => {
      authenticate(user);
      const post = await prisma.post.findUnique({ where: { id } });
      if (!post) throw new GraphQLError('Post not found');
      if (post.authorId !== user.id && !isAdmin(user)) {
        throw new GraphQLError('Not authorized');
      }

      const scheduledAt = new Date(scheduledPublishAt);
      if (scheduledAt <= new Date()) {
        throw new GraphQLError('Scheduled publish time must be in the future');
      }

      return prisma.post.update({
        where: { id },
        data: { scheduledPublishAt: scheduledAt },
      });
    },

    rollbackToVersion: async (_, { postId, versionId }, { user }) => {
      authenticate(user);
      const post = await prisma.post.findUnique({ where: { id: postId } });
      if (!post) throw new GraphQLError('Post not found');
      if (post.authorId !== user.id && !isAdmin(user)) {
        throw new GraphQLError('Not authorized');
      }

      const version = await prisma.postVersion.findUnique({
        where: { id: versionId },
      });
      if (!version || version.postId !== postId) {
        throw new GraphQLError('Version not found');
      }

      const lastVersion = await prisma.postVersion.findFirst({
        where: { postId },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (lastVersion?.version || 0) + 1;

      await prisma.postVersion.create({
        data: {
          postId,
          title: post.title,
          content: post.content,
          tags: post.tags,
          version: nextVersion,
        },
      });

      return prisma.post.update({
        where: { id: postId },
        data: {
          title: version.title,
          content: version.content,
          tags: version.tags,
        },
      });
    },

    createComment: async (_, { postId, content, parentId }, { user }) => {
      authenticate(user);
      const post = await prisma.post.findUnique({ where: { id: postId } });
      if (!post || post.status !== 'PUBLISHED') {
        throw new GraphQLError('Post not found or not published');
      }

      if (parentId) {
        const parentComment = await prisma.comment.findUnique({ where: { id: parentId } });
        if (!parentComment || parentComment.postId !== postId) {
          throw new GraphQLError('Parent comment not found');
        }
      }

      const comment = await prisma.comment.create({
        data: {
          content,
          postId,
          authorId: user.id,
          parentId: parentId || null,
        },
      });

      pubsub.publish(NEW_COMMENT, { newComment: comment });
      return comment;
    },

    reactToComment: async (_, { commentId, type }, { user }) => {
      authenticate(user);
      const comment = await prisma.comment.findUnique({ where: { id: commentId } });
      if (!comment) throw new GraphQLError('Comment not found');

      const existingReaction = await prisma.commentReaction.findUnique({
        where: {
          commentId_authorId: {
            commentId,
            authorId: user.id,
          },
        },
      });

      if (existingReaction) {
        if (existingReaction.type === type) {
          await prisma.commentReaction.delete({ where: { id: existingReaction.id } });
        } else {
          await prisma.commentReaction.update({
            where: { id: existingReaction.id },
            data: { type },
          });
        }
      } else {
        await prisma.commentReaction.create({
          data: {
            type,
            commentId,
            authorId: user.id,
          },
        });
      }

      return prisma.comment.findUnique({ where: { id: commentId } });
    },

    reviewComment: async (_, { id, status }, { user }) => {
      authenticate(user);
      if (!isAdmin(user)) throw new GraphQLError('Not authorized');
      
      const comment = await prisma.comment.update({
        where: { id },
        data: { status },
      });

      pubsub.publish(COMMENT_REVIEWED, { commentReviewed: comment });
      return comment;
    },
  },

  Subscription: {
    newComment: {
      subscribe: () => pubsub.asyncIterator([NEW_COMMENT]),
    },
    commentReviewed: {
      subscribe: () => pubsub.asyncIterator([COMMENT_REVIEWED]),
    },
  },

  Post: {
    author: (post) => prisma.user.findUnique({ where: { id: post.authorId } }),
    versions: (post) =>
      prisma.postVersion.findMany({
        where: { postId: post.id },
        orderBy: { version: 'desc' },
      }),
    comments: (post) =>
      prisma.comment.findMany({
        where: { postId: post.id, status: 'APPROVED', parentId: null },
        orderBy: { createdAt: 'desc' },
      }),
  },

  Comment: {
    author: (comment) =>
      prisma.user.findUnique({ where: { id: comment.authorId } }),
    post: (comment) =>
      prisma.post.findUnique({ where: { id: comment.postId } }),
    parent: (comment) =>
      comment.parentId
        ? prisma.comment.findUnique({ where: { id: comment.parentId } })
        : null,
    replies: (comment) =>
      prisma.comment.findMany({
        where: { parentId: comment.id, status: 'APPROVED' },
        orderBy: { createdAt: 'asc' },
      }),
    likesCount: async (comment) =>
      prisma.commentReaction.count({
        where: { commentId: comment.id, type: 'LIKE' },
      }),
    dislikesCount: async (comment) =>
      prisma.commentReaction.count({
        where: { commentId: comment.id, type: 'DISLIKE' },
      }),
    userReaction: async (comment, _, { user }) => {
      if (!user) return null;
      const reaction = await prisma.commentReaction.findUnique({
        where: {
          commentId_authorId: {
            commentId: comment.id,
            authorId: user.id,
          },
        },
      });
      return reaction?.type || null;
    },
  },

  User: {
    posts: (user) =>
      prisma.post.findMany({ where: { authorId: user.id } }),
  },
};
