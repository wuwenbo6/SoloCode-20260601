import { gql } from '@apollo/client';

export const REGISTER = gql`
  mutation Register($email: String!, $password: String!, $name: String!) {
    register(email: $email, password: $password, name: $name) {
      token
      user {
        id
        email
        name
        role
      }
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        email
        name
        role
      }
    }
  }
`;

export const CREATE_POST = gql`
  mutation CreatePost($title: String!, $content: String!, $tags: [String!]!, $scheduledPublishAt: String) {
    createPost(title: $title, content: $content, tags: $tags, scheduledPublishAt: $scheduledPublishAt) {
      id
      title
      content
      tags
      status
      scheduledPublishAt
    }
  }
`;

export const UPDATE_POST = gql`
  mutation UpdatePost($id: ID!, $title: String!, $content: String!, $tags: [String!]!, $scheduledPublishAt: String) {
    updatePost(id: $id, title: $title, content: $content, tags: $tags, scheduledPublishAt: $scheduledPublishAt) {
      id
      title
      content
      tags
      status
      scheduledPublishAt
    }
  }
`;

export const SCHEDULE_POST = gql`
  mutation SchedulePost($id: ID!, $scheduledPublishAt: String!) {
    schedulePost(id: $id, scheduledPublishAt: $scheduledPublishAt) {
      id
      status
      scheduledPublishAt
    }
  }
`;

export const DELETE_POST = gql`
  mutation DeletePost($id: ID!) {
    deletePost(id: $id)
  }
`;

export const SUBMIT_FOR_REVIEW = gql`
  mutation SubmitForReview($id: ID!) {
    submitForReview(id: $id) {
      id
      status
    }
  }
`;

export const REVIEW_POST = gql`
  mutation ReviewPost($id: ID!, $status: PostStatus!) {
    reviewPost(id: $id, status: $status) {
      id
      status
    }
  }
`;

export const ROLLBACK_TO_VERSION = gql`
  mutation RollbackToVersion($postId: ID!, $versionId: ID!) {
    rollbackToVersion(postId: $postId, versionId: $versionId) {
      id
      title
      content
      tags
    }
  }
`;

export const CREATE_COMMENT = gql`
  mutation CreateComment($postId: ID!, $content: String!, $parentId: ID) {
    createComment(postId: $postId, content: $content, parentId: $parentId) {
      id
      content
      status
    }
  }
`;

export const REACT_TO_COMMENT = gql`
  mutation ReactToComment($commentId: ID!, $type: ReactionType!) {
    reactToComment(commentId: $commentId, type: $type) {
      id
      likesCount
      dislikesCount
      userReaction
    }
  }
`;

export const REVIEW_COMMENT = gql`
  mutation ReviewComment($id: ID!, $status: CommentStatus!) {
    reviewComment(id: $id, status: $status) {
      id
      status
    }
  }
`;
