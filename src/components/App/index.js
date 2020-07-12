import React, { useEffect, useState} from 'react';
import Messenger from '../Messenger';
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import Loading from "../Loading";

import gql from 'graphql-tag';
import { ApolloClient } from 'apollo-client';
import { InMemoryCache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';

import config from "../../auth_config.json";

export const App = () => {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  const CHECK_USER = gql`query checkUser($emailid: String){
    users(where: {
      emailid: {
        _eq: $emailid
      }
    }){
      curgroup
    }
  }`;

  const ADD_USER = gql`mutation addUser($emailid: String, $name: String, $picture: String) {
      insert_users(
        objects: [
          { emailid: $emailid,
            name: $name,
            picture: $picture
          }
        ]
      ) {
        affected_rows
        returning {
          emailid
        }
     }
   }
   `;

  const CHECK_SELF_CHAT = gql`query selfChat($emailid: String) {
    self_chat(args:{
      userid: $emailid
    }){
      groupid
    }
  }`;

  const ADD_GROUP = gql`mutation addGroup($groupname: String, $ischat: Boolean, $picture: String) {
      insert_groups(
        objects: [
          { groupname: $groupname,
            ischat: $ischat,
            picture: $picture
          }
        ]
      ) {
        affected_rows
        returning {
          groupid
        }
     }
   }`;

  const UPDATE_CURGROUP = gql`mutation update_curgroup($emailid: String, $curgroup: bigint) {
    update_users(where: {
      emailid: {
        _eq: $emailid
      }
    }, _set: {curgroup: $curgroup}){
      affected_rows
      returning{
        emailid
        curgroup
      }
    }
  }`;

  const ADD_SELF_PARTICIPANT = gql`mutation add_self_participant($groupid: bigint, $emailid: String) {
      insert_participants(
        objects: [
          { groupid: $groupid,
            emailid: $emailid
          }
        ]
      ) {
        affected_rows
        returning {
          groupid
        }
     }
   }`;

  getAccessTokenSilently().then(token => {
    /* Don't need to set token as a state */
    const cache = new InMemoryCache();
    const link = new HttpLink({
      uri: config.hasuraep,
      headers:{
        "Authorization": `Bearer ${token}`
      }
    });
    const client: ApolloClient<NormalizedCacheObject> = new ApolloClient({
      cache,
      link,
    });

    client.query({
      query: CHECK_USER,
      variables: {
        emailid: user.email
      }
    }).then(result => {
      if(result.data.users[0].curgroup == null) {
        client.query({
          query: CHECK_SELF_CHAT,
          variables: {
            emailid: user.email
          }
        }).then(result => {
          if(result.data.self_chat.length == 0){
            // Add group
            client.mutate({
              mutation: ADD_GROUP,
              variables: {
                groupname: user.name,
                picture: user.picture,
                ischat: false
              }
            }).then(result => {
              // Add participants
              client.mutate({
                mutation: ADD_SELF_PARTICIPANT,
                variables: {
                  groupid: result.data.insert_groups.returning[0].groupid,
                  emailid: user.email
                }
              }).then(result => {
                client.mutate({
                  mutation: UPDATE_CURGROUP,
                  variables: {
                    emailid: user.email,
                    curgroup: result.data.insert_participants.returning[0].groupid
                  }
                });
              });
            });
          } else if(result.data.self_chat[0].users.length == 0){
            client.mutate({
              mutation: ADD_SELF_PARTICIPANT,
              variables: {
                groupid: result.data.insert_groups.returning[0].groupid,
                emailid: user.email
              }
            }).then(result => {
              client.mutate({
                mutation: UPDATE_CURGROUP,
                variables: {
                  emailid: user.email,
                  curgroup: result.data.insert_participants.returning[0].groupid
                }
              });
            });
          } else {
            client.mutate({
              mutation: UPDATE_CURGROUP,
              variables: {
                emailid: user.email,
                curgroup: result.data.self_chat[0].groupid
              }
            });
          }
        });
      }
    });
  });

  return (
    <div className="App">
      <Messenger />
    </div>
  );
}

export default withAuthenticationRequired(App, {
  onRedirecting: () => <Loading />,
});
