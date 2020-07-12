import React, { useState } from 'react';
import './Compose.css';

import gql from 'graphql-tag';
import { ApolloClient } from 'apollo-client';
import { InMemoryCache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import { useAuth0 } from "@auth0/auth0-react";

import config from "../../auth_config.json";

export default function Compose(props) {

  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [token, setToken] = useState('');

  function getToken(){
    let tempToken = '';
    const asyncGetToken = async() => {
        tempToken = await getAccessTokenSilently();
        setToken(tempToken);
    }
    asyncGetToken();
  }

  getToken();

  const cache = new InMemoryCache();
  const link = new HttpLink({
    uri: config.hasuraep,
    headers:{
      "Authorization": `Bearer ${token}`
    }
  });
  const client: ApolloClient<NormalizedCacheObject> = new ApolloClient({
    cache,
    link
  });

  const INSERT_MESSAGE = gql`mutation insertMessage($groupid: bigint, $emailid: String, $message: String, $senttime: timestamptz){
    insert_messages(objects:[
      {
        emailid: $emailid,
        groupid: $groupid,
        message: $message,
        senttime: $senttime
      }
    ]){
      affected_rows
      returning {
        senttime
      }
    }
  }`;

  const QUERY_CURGROUP = gql`query getCurgroup($emailid: String){
    users(where:{
      emailid: {
        _eq: $emailid
      }
    }){
      curgroup
    }
  }`;

    return (
      <div className="compose">
        <input
          type="text"
          className="compose-input"
          placeholder="Type a message"
          onKeyDown={e => {
            if(e.key == 'Enter'){
              let message = e.target.value;
              e.target.value = "";
              client.query({
                query: QUERY_CURGROUP,
                variables: {
                  emailid: user.email
                }
              }).then(result => {
                client.mutate({
                  mutation: INSERT_MESSAGE,
                  variables: {
                    groupid: result.data.users[0].curgroup,
                    emailid: user.email,
                    message: message,
                    senttime: new Date()
                  }
                }).then(result => console.log("added message"));
              });
            }
          }}
        />

        {
          props.rightItems
        }
      </div>
    );
}
