import React, {useEffect} from 'react';

import './ConversationListItem.css';
import { ApolloClient } from 'apollo-client';
import { InMemoryCache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import gql from 'graphql-tag';
import { useAuth0} from "@auth0/auth0-react";

import config from "../../auth_config.json";

export default function ConversationListItem(props) {

    const { photo, name, text, groupid } = props.data;

    const { user } = useAuth0();
    const cache = new InMemoryCache();
    const link = new HttpLink({
      uri: config.hasuraep,
      headers:{
        "x-hasura-admin-secret": config.admsec
      }
    });    const client: ApolloClient<NormalizedCacheObject> = new ApolloClient({
      cache,
      link
    });

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

    const ADD_CHAT = gql`mutation addChat{
      insert_groups(objects:[
        {
          ischat: true
        }
      ]){
        affected_rows
        returning{
          groupid
          groupname
        }
      }
    }`;

    const ADD_PARTICIPANT = gql`mutation addParticipant($emailid: String, $groupid: bigint, $lastseen: timestamptz){
      insert_participants_one(object:{
        groupid: $groupid,
        emailid: $emailid,
        lastseen: $lastseen
      }){
    		groupid
      }
    }`;

    return (
      <div className="conversation-list-item" onClick={() =>{
          // First check if the group exists or not
          let newgid = groupid;
          if(groupid == 0){
            client.mutate({
              mutation: ADD_CHAT
            }).then(result => {
                let newgid = result.data.insert_groups.returning[0].groupid
                // add participants
                client.mutate({
                  mutation: ADD_PARTICIPANT,
                  variables: {
                    emailid: user.email,
                    groupid: newgid,
                    lastseen: new Date()
                  }
                });
                client.mutate({
                  mutation: ADD_PARTICIPANT,
                  variables: {
                    emailid: text,
                    groupid: newgid,
                    lastseen: new Date()
                  }
                });
            });
          } else {
            client.mutate({
              mutation: ADD_PARTICIPANT,
              variables: {
                emailid: user.email,
                groupid: groupid,
                lastseen: new Date()
              }
            }).then(result => console.log("added to group!"));
          }

          // update current group
          client.mutate({
            mutation: UPDATE_CURGROUP,
            variables: {
              emailid: user.email,
              curgroup: groupid
            }
          }).then(result => console.log(result));
      }}>
        <img className="conversation-photo" src={photo} alt="conversation" />
        <div className="conversation-info">
          <h1 className="conversation-title">{ name }</h1>
          <p className="conversation-snippet">{ text }</p>
        </div>
      </div>
    );
}
