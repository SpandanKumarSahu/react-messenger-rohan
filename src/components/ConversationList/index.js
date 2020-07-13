import React, {useState, useEffect, useRef} from 'react';
import Toolbar from '../Toolbar';
import ToolbarButton from '../ToolbarButton';
import './ConversationList.css';
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
  const [curGroupChecked, setCurGroupChecked] = useState(false);
  const [token, setToken] = useState('');

  const { user, getAccessTokenSilently, logout } = useAuth0();

  const QUERY_CONVERSATIONS = gql`query getConversationList($emailid: String, $queryText: String){
    conversation_groups(args:{
      uid: $emailid
    }, where: {
      groupname: {
        _ilike: $queryText
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
        _ilike: $queryText
      }
    }, limit: 10){
      groupid
      groupname
      picture
      message
    }
  }`;

  const QUERY_GROUP_MEMBERS = gql`query getMembers($emailid: String, $queryText: String){
    group_members(args:{
      uid: $emailid
    }, where: {
      groupname: {
        _ilike: $queryText
      }
    }){
      groupid
      groupname
      picture
      message
    }
  }`;

  const QUERY_JUST_USERS = gql`query getOtherUsers($emailid: String, $queryText: String){
    just_users(args:{
      uid: $emailid
    }, where:{
      groupname: {
        _ilike: $queryText
      }
    }){
      groupid
      groupname
      picture
      message
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

  const ADD_GROUP = gql`mutation create_group($ischat: Boolean){
    insert_groups(objects:[
      {
        ischat: $ischat
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

  const QUERY_CURGROUP_INFO = gql`query getGroupInfo($emailid: String){
    group_type_check(args:{
      uid: $emailid
    }){
      groupid
     	groupname
    	picture
    	ischat
    }
  }`;

  const QUERY_MEMBERS_COUNT = gql`query getMembersCount($emailid: String, $groupid: bigint){
    groups(where: {
      groupid: {
        _eq: $groupid
      }
    }){
      participants{
        emailid
      }
    }
  }`

  function getToken(){
    let tempToken = '';
    const asyncGetToken = async() => {
        tempToken = await getAccessTokenSilently();
        setToken(tempToken);
    }
    asyncGetToken();
  }

  const cache = new InMemoryCache();
  getToken();

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

  function updateConversations(){
    if(curGroupChecked == false){
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
    } else {
      if(checked == true){
        client.query({
          query: QUERY_GROUP_MEMBERS,
          variables: {
            emailid: user.email,
            queryText: "%"+queryText+"%"
          }
        }).then(result => {
          let newConversations = result.data.group_members.map(chat => {
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
          query: QUERY_JUST_USERS,
          variables: {
            emailid: user.email,
            queryText: "%"+queryText+"%"
          }
        }).then(result => {
          let newConversations = result.data.just_users.map(chat => {
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
    }
  }

  function logoutWithRedirect(e){
    logout({
      returnTo: window.location.origin,
    });
  }

  function handleSwitch(val){
    setChecked(val);
    updateConversations();
  }

  function handleCurGroupSwitch(val){
    setCurGroupChecked(val);
    updateConversations();
  }

  useEffect(() => {
    updateConversations();
  }, []);

  useInterval(() => {
    updateConversations();
  }, config.pollInterval);

  return (
    <div className="conversation-list">
      <Toolbar
        title={[
          <a href="#" onClick={logoutWithRedirect}> <ToolbarButton key="power" icon="ion-ios-power" /> </a>
        ]}
        leftItems={[
          <Switch onChange={handleCurGroupSwitch} checked={curGroupChecked} />,
        ]}
        rightItems={[
          <Switch onChange={handleSwitch} checked={checked} />,
        ]}
      />
      <div className="conversation-search">
        <input
          type="search"
          className="conversation-search-input"
          placeholder="Search Messages"
          onChange={e => {
            setQueryText(e.target.value);
            updateConversations();
          }}
        />
      </div>
      {
        conversations.map(conversation =>
          <div className="conversation-list-item" onClick={() =>{
            client.query({
              query: QUERY_CURGROUP_INFO,
              variables: {
                emailid: user.email
              }
            }).then(result => {
              let _curgroup = result.data.group_type_check[0].groupid;
              let _isSelfChat = result.data.group_type_check[0].ischat;
              if(checked == true){
                /* Update group based on what is clicked */
                client.mutate({
                  mutation: UPDATE_CURGROUP,
                  variables: {
                    emailid: user.email,
                    curgroup: conversation.groupid
                  }
                });
              } else {
                if(curGroupChecked == false){
                  /* Create group with user, or join a group */
                  let newgid = conversation.groupid;
                  if(conversation.groupid == 0){
                    /* Create a group with user */
                    client.mutate({
                      mutation: ADD_GROUP,
                      variables: {
                        ischat: true
                      }
                    }).then(result => {
                        newgid = result.data.insert_groups.returning[0].groupid
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
                            emailid: conversation.text,
                            groupid: newgid,
                            lastseen: new Date()
                          }
                        });
                    });
                  }
                  client.mutate({
                    mutation: UPDATE_CURGROUP,
                    variables: {
                      emailid: user.email,
                      curgroup: newgid
                    }
                  });
                } else {
                  /* if ischat, or self-group recrete group. Else add to group */
                  let newgid = _curgroup;
                  client.query({
                    query: QUERY_MEMBERS_COUNT,
                    variables: {
                      groupid: _curgroup
                    }
                  }).then(result => {
                    let d = new Date();
                    /*if self group, or is chat, recrete the group */
                    if(result.data.groups[0].participants.length == 1 || _isSelfChat){
                      /*create new group */
                      client.mutate({
                        mutation: ADD_GROUP,
                        variables: {
                          ischat: false
                        }
                      }).then(newresult => {
                        newgid = newresult.data.insert_groups.returning[0].groupid;
                        for(var i=0; i<result.data.groups[0].participants.length; i += 1){
                          client.mutate({
                            mutation: ADD_PARTICIPANT,
                            variables: {
                              groupid: newgid,
                              emailid: result.data.groups[0].participants[i].emailid,
                              lastseen: d
                            }
                          });
                        }

                        /*add the new participant to the group (ignore error) */
                        client.mutate({
                          mutation: ADD_PARTICIPANT,
                          variables: {
                            groupid: newgid,
                            emailid: conversation.text,
                            lastseen: d
                          }
                        });

                        /* update the curgroup */
                        client.mutate({
                          mutation: UPDATE_CURGROUP,
                          variables: {
                            emailid: user.email,
                            curgroup: newgid
                          }
                        });

                      });
                    } else {
                      /*add the new participant to the group (ignore error) */
                      client.mutate({
                        mutation: ADD_PARTICIPANT,
                        variables: {
                          groupid: newgid,
                          emailid: conversation.text,
                          lastseen: d
                        }
                      });

                      /* update the curgroup */
                      client.mutate({
                        mutation: UPDATE_CURGROUP,
                        variables: {
                          emailid: user.email,
                          curgroup: newgid
                        }
                      });

                    }
                  });
                }
              }
            });
          }}>
            <img className="conversation-photo" src={conversation.photo} alt="conversation" />
            <div className="conversation-info">
              <h1 className="conversation-title">{ conversation.name }</h1>
              <p className="conversation-snippet">{ conversation.text }</p>
            </div>
          </div>

        )
      }
    </div>
  );

}
