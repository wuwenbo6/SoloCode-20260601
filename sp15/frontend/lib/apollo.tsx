'use client';

import { ApolloClient, InMemoryCache, HttpLink, split, ApolloProvider } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { ReactNode, useMemo } from 'react';

const httpLink = new HttpLink({
  uri: 'http://localhost:4000/graphql',
  credentials: 'same-origin',
  headers: {
    authorization: typeof window !== 'undefined' ? `Bearer ${localStorage.getItem('token') || ''}` : '',
  },
});

const wsLink =
  typeof window !== 'undefined'
    ? new GraphQLWsLink(
        createClient({
          url: 'ws://localhost:4000/graphql',
          connectionParams: () => {
            const token = localStorage.getItem('token') || '';
            return { token };
          },
        })
      )
    : null;

const splitLink = wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
      },
      wsLink,
      httpLink
    )
  : httpLink;

export function ApolloWrapper({ children }: { children: ReactNode }) {
  const client = useMemo(
    () =>
      new ApolloClient({
        link: splitLink,
        cache: new InMemoryCache(),
      }),
    []
  );

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
