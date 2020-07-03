import React, {useEffect, useState, useRef} from 'react';
import Compose from '../Compose';
import Toolbar from '../Toolbar';
import ToolbarButton from '../ToolbarButton';
import Message from '../Message';
import moment from 'moment';

import './MessageList.css';

import { ApolloClient } from 'apollo-client';
import { InMemoryCache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import gql from 'graphql-tag';
import { useAuth0 } from "@auth0/auth0-react";

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

export default function MessageList(props) {
  const [messages, setMessages] = useState([]);
  const [convInfo, setConvInfo] = useState({});

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

  const { user } = useAuth0();

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

  const QUERY_NEW_MESSAGES = gql`query getMessages($emailid: String){
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

  const QUERY_CURGROUP = gql`query getCurgroup($emailid: String){
    users(where:{
      emailid: {
        _eq: $emailid
      }
    }){
      curgroup
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
      uid: $emailid,
      gid: $groupid
    }){
      groupid
      groupname
      picture
    }
  }`;

  useEffect(() => {
    client.query({
      query: QUERY_CURGROUP,
      variables: {
        emailid: user.email
      }
    }).then(result => {
      client.query({
        query: QUERY_CONVERSATIONS_INFO,
        variables: {
          emailid: user.email,
          groupid: result.data.users[0].curgroup
        }
      }).then(result => {
        setConvInfo({
          title: result.data.conversation_info[0].groupname,
          picture: result.data.conversation_info[0].picture,
          groupid: result.data.conversation_info[0].groupid
        });
      });
    });

    // fetch messages
    const transTime =new Date();
    client.query({
      query: QUERY_MESSAGES,
      variables: {
        emailid: user.email
      }
    }).then(result => {
      let newMessages = result.data.updated_current_messages.map((message, idx) => {
        const ep = new Date();
        return {
          id: '' + ep.getTime() + idx,
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
      setMessages([...tempMessages]);
    });

    // update lastseen
    client.query({
      query: QUERY_CURGROUP,
      variables: {
        emailid: user.email
      }
    }).then(result => {
      client.mutate({
        mutation: UPDATE_LASTSEEN,
        variables: {
          emailid: user.email,
          groupid: result.data.users[0].curgroup,
          lastseen: transTime
        }
      });
    });
  },[]);

  useInterval(() => {
    // check if curgroup has changed
    client.query({
      query: QUERY_CURGROUP,
      variables: {
        emailid: user.email
      }
    }).then(result => {
      if(result.data.users[0].curgroup != convInfo.groupid){
        //update conversation info
        client.query({
          query: QUERY_CONVERSATIONS_INFO,
          variables: {
            emailid: user.email,
            groupid: result.data.users[0].curgroup
          }
        }).then(result => {
          setConvInfo({
            title: result.data.conversation_info[0].groupname,
            picture: result.data.conversation_info[0].picture,
            groupid: result.data.conversation_info[0].groupid
          })
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
            const ep = new Date();
            return {
              id: '' + ep.getTime() + idx,
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
          setMessages([...tempMessages]);
        });

        // update lastseen
        client.query({
          query: QUERY_CURGROUP,
          variables: {
            emailid: user.email
          }
        }).then(result => {
          client.mutate({
            mutation: UPDATE_LASTSEEN,
            variables: {
              emailid: user.email,
              groupid: result.data.users[0].curgroup,
              lastseen: transTime
            }
          });
        });

      }
    });

    // fetch messages
    const transTime = new Date();
    client.query({
      query: QUERY_NEW_MESSAGES,
      variables: {
        emailid: user.email
      }
    }).then(result => {
      let newMessages = result.data.current_messages.map((message, idx) => {
        const ep = new Date();
        return {
          id: '' + ep.getTime() + idx,
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
      setMessages([...messages, ...tempMessages]);
    }).then(result => {
      // update lastseen
      client.query({
        query: QUERY_CURGROUP,
        variables: {
          emailid: user.email
        }
      }).then(result => {
        client.mutate({
          mutation: UPDATE_LASTSEEN,
          variables: {
            emailid: user.email,
            groupid: result.data.users[0].curgroup,
            lastseen: transTime
          }
        }).then(result => console.log("updated lastseen"));
      });
    });
  }, config.pollInterval);

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
          <Message key={message.key} isMine={message.isMine} startsSequence={message.startsSequence}
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
