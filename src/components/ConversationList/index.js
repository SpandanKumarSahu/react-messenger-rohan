import React, {useState, useEffect, useRef} from 'react';
import ConversationListItem from '../ConversationListItem';
import Toolbar from '../Toolbar';
import ToolbarButton from '../ToolbarButton';
import './ConversationList.css';
import axios from 'axios';
import gql from 'graphql-tag';

import Switch from "react-switch";
import { useAuth0 } from "@auth0/auth0-react";

import { ApolloClient } from 'apollo-client';
import { InMemoryCache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';

import config from "../../auth_config.json";

function useInterval(callback, delay) {
  const savedCallback = useRef();

  // Remember the latest function.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

export default function ConversationList(props) {
  const [conversations, setConversations] = useState([]);
  const [queryText, setQueryText] = useState('');
  const [checked, setChecked] = useState(true);

  const {
    user,
    logout
  } = useAuth0();

  const cache = new InMemoryCache();
  const link = new HttpLink({
    uri: config.hasuraep,
    headers:{
      "x-hasura-admin-secret": config.admsec
    }
  });
  const client: ApolloClient<NormalizedCacheObject> = new ApolloClient({
    cache,
    link
  });

  const QUERY_CONVERSATIONS = gql`query getConversationList($emailid: String, $queryText: String){
    conversation_groups(args:{
      uid: $emailid
    }, where: {
      groupname: {
        _like: $queryText
      }
    }, limit: 10){
      groupid
      groupname
      picture
      message
    }
  }`;

  const QUERY_NEW_GROUPS = gql`query newConversationQuery($emailid: String, $queryText: String){
    new_conversation_groups(args:{
      uid: $emailid
    }, where: {
      groupname: {
        _like: $queryText
      }
    }, limit: 10){
      groupid
      groupname
      picture
      message
    }
  }`;

  useEffect(() => {
    if(checked == true){
      client.query({
        query: QUERY_CONVERSATIONS,
        variables: {
          emailid: user.email,
          queryText: "%"+queryText+"%"
        }
      }).then(result => {
        let newConversations = result.data.conversation_groups.map(chat => {
          return {
            name: chat.groupname,
            photo: chat.picture,
            text: chat.message,
            groupid: chat.groupid
          }
        });
        setConversations([...newConversations]);
      });
    }
    else {
      client.query({
        query: QUERY_NEW_GROUPS,
        variables: {
          emailid: user.email,
          queryText: "%"+queryText+"%"
        }
      }).then(result => {
        let newConversations = result.data.new_conversation_groups.map(chat => {
          return {
            name: chat.groupname,
            photo: chat.picture,
            text: chat.message,
            groupid: chat.groupid
          }
        });
        setConversations([...newConversations]);
      });
    }
  }, []);

  useInterval(() => {
    if(checked == true){
      client.query({
        query: QUERY_CONVERSATIONS,
        variables: {
          emailid: user.email,
          queryText: "%"+queryText+"%"
        }
      }).then(result => {
        let newConversations = result.data.conversation_groups.map(chat => {
          return {
            name: chat.groupname,
            photo: chat.picture,
            text: chat.message,
            groupid: chat.groupid
          }
        });
        setConversations([...newConversations]);
      });
    }
    else {
      client.query({
        query: QUERY_NEW_GROUPS,
        variables: {
          emailid: user.email,
          queryText: "%"+queryText+"%"
        }
      }).then(result => {
        let newConversations = result.data.new_conversation_groups.map(chat => {
          return {
            name: chat.groupname,
            photo: chat.picture,
            text: chat.message,
            groupid: chat.groupid
          }
        });
        setConversations([...newConversations]);
      });
    }
  }, config.pollInterval);

  function logoutWithRedirect(e){
    logout({
      returnTo: window.location.origin,
    });
  }

  function handleSwitch(val){
    setChecked(val);
  }

  return (
    <div className="conversation-list">
      <Toolbar
        title="Messenger"
        leftItems={[
          <a href="#" onClick={logoutWithRedirect}> <ToolbarButton key="power" icon="ion-ios-power" /> </a>
        ]}
        rightItems={[
          <Switch onChange={handleSwitch} checked={checked} />
        ]}
      />
      <div className="conversation-search">
        <input
          type="search"
          className="conversation-search-input"
          placeholder="Search Messages"
          onChange={e => {
            let _val = e.target.value;
            setQueryText(_val);
            if(checked == true){
              client.query({
                query: QUERY_CONVERSATIONS,
                variables: {
                  emailid: user.email,
                  queryText: "%"+_val+"%"
                }
              }).then(result => {
                let newConversations = result.data.conversation_groups.map(chat => {
                  return {
                    name: chat.groupname,
                    photo: chat.picture,
                    text: chat.message,
                    groupid: chat.groupid
                  }
                });
                setConversations([...newConversations]);
              });
            }
            else {
              client.query({
                query: QUERY_NEW_GROUPS,
                variables: {
                  emailid: user.email,
                  queryText: "%"+_val+"%"
                }
              }).then(result => {
                let newConversations = result.data.new_conversation_groups.map(chat => {
                  return {
                    name: chat.groupname,
                    photo: chat.picture,
                    text: chat.message,
                    groupid: chat.groupid
                  }
                });
                setConversations([...newConversations]);
              });
            }
          }}
        />
      </div>
      {
        conversations.map(conversation =>
          <ConversationListItem
            key={conversation.name}
            data={conversation}
          />
        )
      }
    </div>
  );
}
