import React, { useState } from 'react';
import Compose from '../Compose';
import Toolbar from '../Toolbar';
import ToolbarButton from '../ToolbarButton';
import Message from '../Message';
import moment from 'moment';

import './MessageList.css';

import { ApolloClient } from 'apollo-client';
import { InMemoryCache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import { WebSocketLink } from 'apollo-link-ws';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import { getMainDefinition } from 'apollo-utilities';
import {useSubscription} from '@apollo/react-hooks';

import { split } from 'apollo-link';

import gql from 'graphql-tag';
import { useAuth0 } from "@auth0/auth0-react";

import config from "../../auth_config.json";

export default function MessageList(props) {
  const [messages, setMessages] = useState([]);
  const [convInfo, setConvInfo] = useState({});
  const [token, setToken] = useState('');
  const [curGroup, setCurGroup] = useState(0);

  const { user, getAccessTokenSilently } = useAuth0();

  function getToken(){
    let tempToken = '';
    const asyncGetToken = async() => {
        tempToken = await getAccessTokenSilently();
        setToken(tempToken);
    }
    asyncGetToken();
  }

  getToken();

  const httpLink = new HttpLink({
    uri: config.hasuraep,
    headers:{
      "Authorization": `Bearer ${token}`
    }
  });

  const subClient = new SubscriptionClient(config.hasuraepws, {
    reconnect: true,
    timeout: 30000,
    connectionParams: {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    }
  });
  subClient.maxConnectTimeGenerator.duration = () => subClient.maxConnectTimeGenerator.max;

  const wsLink = new WebSocketLink(subClient);

  const link = split(
    // split based on operation type
    ({ query }) => {
      const { kind, operation } = getMainDefinition(query);
      return kind === 'OperationDefinition' && operation === 'subscription';
    },
    wsLink,
    httpLink,
  );

  const client: ApolloClient<NormalizedCacheObject> = new ApolloClient({
    link: link,
    cache: new InMemoryCache()
  });

  const QUERY_MESSAGES = gql`query getMessages($emailid: String){
    updated_current_messages(args:{
      uid: $emailid
    }, order_by: {
      senttime: asc
    }){
      groupid
      message
      senttime
      emailid
    }
  }`;

  const SUBSCRIBE_NEW_MESSAGES = gql`subscription getMessages($emailid: String){
    current_messages(args:{
      uid: $emailid
    }, order_by: {
      senttime: asc
    }){
      groupid
      message
      senttime
      emailid
    }
  }`;

  const UPDATE_LASTSEEN = gql`mutation updateLastseen($emailid: String, $groupid: bigint, $lastseen: timestamptz){
    update_participants(where: {
      _and: [
        {emailid: {_eq: $emailid}},
        {groupid: {_eq: $groupid}}
      ]
    }, _set: {lastseen: $lastseen}){
      affected_rows
      returning{
        lastseen
      }
    }
  }`;

  const QUERY_CONVERSATIONS_INFO = gql`query getConversationTitle($emailid: String, $groupid: bigint){
    conversation_info(args:{
      uid: $emailid
    }){
      groupid
      groupname
      picture
    }
  }`;

  useSubscription(SUBSCRIBE_NEW_MESSAGES, {
    variables: {
      emailid: user.email
    },
    client: client,
    shouldResubscribe: true,
    onSubscriptionData: ({cl, subscriptionData}) => {
      if(subscriptionData.data.current_messages.length == 0 || subscriptionData.data.current_messages[0].groupid != curGroup){
        client.query({
          query: QUERY_CONVERSATIONS_INFO,
          variables: {
            emailid: user.email
          }
        }).then(result => {
          if(result.data.conversation_info.length > 0){
            let _tempCurGroup  = result.data.conversation_info[0].groupid;

            if(_tempCurGroup != curGroup){
              /* change of groups, update messages and headers */

              // set conversation header
              setConvInfo({
                title: result.data.conversation_info[0].groupname,
                picture: result.data.conversation_info[0].picture,
                groupid: result.data.conversation_info[0].groupid
              });

              // fetch messages
              const transTime = new Date();
              client.query({
                query: QUERY_MESSAGES,
                variables: {
                  emailid: user.email
                }
              }).then(result => {
                let newMessages = result.data.updated_current_messages.map((message, idx) => {
                  return {
                    id: '' + message.senttime + ' ' + message.emailid,
                    author: message.emailid,
                    timestamp: message.senttime,
                    message: message.message,
                  }
                });
                let i = 0;
                let messageCount = newMessages.length;
                let tempMessages = [];

                while (i < messageCount) {
                  let previous = newMessages[i - 1];
                  let current = newMessages[i];
                  let next = newMessages[i + 1];
                  let isMine = current.author === user.email;
                  let currentMoment = moment(current.timestamp);
                  let prevBySameAuthor = false;
                  let nextBySameAuthor = false;
                  let startsSequence = true;
                  let endsSequence = true;
                  let showTimestamp = true;

                  if (previous) {
                    let previousMoment = moment(previous.timestamp);
                    let previousDuration = moment.duration(currentMoment.diff(previousMoment));
                    prevBySameAuthor = previous.author === current.author;

                    if (prevBySameAuthor && previousDuration.as('hours') < 1) {
                      startsSequence = false;
                    }

                    if (previousDuration.as('hours') < 1) {
                      showTimestamp = false;
                    }
                  }

                  if (next) {
                    let nextMoment = moment(next.timestamp);
                    let nextDuration = moment.duration(nextMoment.diff(currentMoment));
                    nextBySameAuthor = next.author === current.author;

                    if (nextBySameAuthor && nextDuration.as('hours') < 1) {
                      endsSequence = false;
                    }
                  }

                  tempMessages.push({
                    key: i,
                    isMine: isMine,
                    startsSequence: startsSequence,
                    endsSequence: endsSequence,
                    showTimestamp: showTimestamp,
                    data: current
                  });
                  // Proceed to the next message.
                  i += 1;
                }

                // set messages
                setMessages([...tempMessages]);

                // update lastseen
                client.mutate({
                  mutation: UPDATE_LASTSEEN,
                  variables: {
                    emailid: user.email,
                    groupid: _tempCurGroup,
                    lastseen: transTime
                  }
                });

                // set current group
                setCurGroup(_tempCurGroup);
            });
          }
        }
      });
    } else {
      // process the new messages
      const transTime = new Date();
      let newMessages = subscriptionData.data.current_messages.map((message, idx) => {
        return {
          id: '' + message.senttime + ' ' + message.emailid,
          author: message.emailid,
          timestamp: message.senttime,
          message: message.message,
        }
      });
      let i = 0;
      let messageCount = newMessages.length;
      let tempMessages = [];

      while (i < messageCount) {
        let previous = newMessages[i - 1];
        if(i==0 && messages.length > 0){
          previous = messages[messages.length-1].data;
        }
        let current = newMessages[i];
        let next = newMessages[i + 1];
        let isMine = current.author === user.email;
        let currentMoment = moment(current.timestamp);
        let prevBySameAuthor = false;
        let nextBySameAuthor = false;
        let startsSequence = true;
        let endsSequence = true;
        let showTimestamp = true;

        if (previous) {
          let previousMoment = moment(previous.timestamp);
          let previousDuration = moment.duration(currentMoment.diff(previousMoment));
          prevBySameAuthor = previous.author === current.author;

          if (prevBySameAuthor && previousDuration.as('hours') < 1) {
            startsSequence = false;
          }

          if (previousDuration.as('hours') < 1) {
            showTimestamp = false;
          }
        }

        if (next) {
          let nextMoment = moment(next.timestamp);
          let nextDuration = moment.duration(nextMoment.diff(currentMoment));
          nextBySameAuthor = next.author === current.author;

          if (nextBySameAuthor && nextDuration.as('hours') < 1) {
            endsSequence = false;
          }
        }

        tempMessages.push({
          key: i,
          isMine: isMine,
          startsSequence: startsSequence,
          endsSequence: endsSequence,
          showTimestamp: showTimestamp,
          data: current
        });
        // Proceed to the next message.
        i += 1;
      }

      // update the messages state
      setMessages([...messages, ...tempMessages]);

      // update lastseen
      client.mutate({
        mutation: UPDATE_LASTSEEN,
        variables: {
          emailid: user.email,
          groupid: curGroup,
          lastseen: transTime
        }
      });
    }
    }
  });

    return(
      <div className="message-list">
        <Toolbar
          title={convInfo.title}
          rightItems={[
            <ToolbarButton key="info" icon="ion-ios-information-circle-outline" />,
            <ToolbarButton key="video" icon="ion-ios-videocam" />,
            <ToolbarButton key="phone" icon="ion-ios-call" />
          ]}
        />

        <div className="message-list-container">{messages.map(message => (
          <Message key={message.data.id} isMine={message.isMine} startsSequence={message.startsSequence}
            endsSequence={message.endsSequence} showTimestamp={message.showTimestamp} data={message.data}
          />
        ))}</div>

        <Compose rightItems={[
          <ToolbarButton key="photo" icon="ion-ios-camera" />,
          <ToolbarButton key="image" icon="ion-ios-image" />,
          <ToolbarButton key="audio" icon="ion-ios-mic" />,
          <ToolbarButton key="money" icon="ion-ios-card" />,
          <ToolbarButton key="games" icon="ion-logo-game-controller-b" />,
          <ToolbarButton key="emoji" icon="ion-ios-happy" />
        ]}/>
      </div>
    );
}
