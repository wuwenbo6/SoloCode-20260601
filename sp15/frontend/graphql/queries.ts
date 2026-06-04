import { gql } from '@apollo/client';

export const ME = gql`
  query Me {
    me {
      id
      email
      name
      role
    }
  }
`;

export const POSTS = gql`
  query Posts($status: PostStatus) {
    posts(status: $status) {
      id
      title
      tags
      status
      createdAt
      author {
        name
      }
    }
  }
`;

export const POST = gql`
  query Post($id: ID!) {
    post(id: $id) {
      id
      title
      content
      tags
      status
      scheduledPublishAt
      createdAt
      author {
        id
        name
      }
      comments {
        id
        content
        status
        likesCount
        dislikesCount
        userReaction
        createdAt
        author {
          id
          name
        }
        replies {
          id
          content
          status
          likesCount
          dislikesCount
          userReaction
          createdAt
          author {
            id
            name
          }
          replies {
            id
            content
            status
            likesCount
            dislikesCount
            userReaction
            createdAt
            author {
              id
              name
            }
          }
        }
      }
    }
  }
`;

export const MY_POSTS = gql`
  query MyPosts {
    myPosts {
      id
      title
      status
      createdAt
    }
  }
`;

export const POST_VERSIONS = gql`
  query PostVersions($postId: ID!) {
    postVersions(postId: $postId) {
      id
      title
      content
      tags
      version
      createdAt
    }
  }
`;

export const PENDING_COMMENTS = gql`
  query PendingComments {
    pendingComments {
      id
      content
      createdAt
      author {
        name
      }
      post {
        id
        title
      }
    }
  }
`;

export const NEW_COMMENT_SUBSCRIPTION = gql`
  subscription NewComment {
    newComment {
      id
      content
      createdAt
      author {
        name
      }
      post {
        id
        title
      }
    }
  }
`;

export const COMMENT_REVIEWED_SUBSCRIPTION = gql`
  subscription CommentReviewed {
    commentReviewed {
      id
      content
      status
    }
  }
`;

export const SEARCH_POSTS = gql`
  query SearchPosts($query: String!) {
    searchPosts(query: $query) {
      posts {
        id
        title
        content
        tags
        status
        scheduledPublishAt
        createdAt
        author {
          name
        }
      }
      total
    }
  }
`;
