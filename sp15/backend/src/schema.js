export const typeDefs = `#graphql
  enum UserRole {
    AUTHOR
    ADMIN
  }

  enum PostStatus {
    DRAFT
    PENDING_REVIEW
    PUBLISHED
  }

  enum CommentStatus {
    PENDING
    APPROVED
    REJECTED
  }

  enum ReactionType {
    LIKE
    DISLIKE
  }

  type User {
    id: ID!
    email: String!
    name: String!
    role: UserRole!
    posts: [Post!]!
    comments: [Comment!]!
    createdAt: String!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    tags: [String!]!
    status: PostStatus!
    scheduledPublishAt: String
    author: User!
    versions: [PostVersion!]!
    comments: [Comment!]!
    createdAt: String!
    updatedAt: String!
  }

  type PostVersion {
    id: ID!
    postId: ID!
    title: String!
    content: String!
    tags: [String!]!
    version: Int!
    createdAt: String!
  }

  type Comment {
    id: ID!
    content: String!
    status: CommentStatus!
    post: Post!
    author: User!
    parent: Comment
    replies: [Comment!]!
    likesCount: Int!
    dislikesCount: Int!
    userReaction: ReactionType
    createdAt: String!
  }

  type SearchResult {
    posts: [Post!]!
    total: Int!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    me: User
    posts(status: PostStatus): [Post!]!
    post(id: ID!): Post
    myPosts: [Post!]!
    pendingComments: [Comment!]!
    postVersions(postId: ID!): [PostVersion!]!
    searchPosts(query: String!): SearchResult!
  }

  type Mutation {
    register(email: String!, password: String!, name: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    
    createPost(title: String!, content: String!, tags: [String!]!, scheduledPublishAt: String): Post!
    updatePost(id: ID!, title: String!, content: String!, tags: [String!]!, scheduledPublishAt: String): Post!
    deletePost(id: ID!): Boolean!
    submitForReview(id: ID!): Post!
    reviewPost(id: ID!, status: PostStatus!): Post!
    schedulePost(id: ID!, scheduledPublishAt: String!): Post!
    rollbackToVersion(postId: ID!, versionId: ID!): Post!
    
    createComment(postId: ID!, content: String!, parentId: ID): Comment!
    reviewComment(id: ID!, status: CommentStatus!): Comment!
    reactToComment(commentId: ID!, type: ReactionType!): Comment!
  }

  type Subscription {
    newComment: Comment!
    commentReviewed: Comment!
  }
`;
