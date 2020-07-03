import { useAuth0 } from "@auth0/auth0-react";
import React from 'react';
import { Route, Router, Switch } from "react-router-dom";
import { Container } from "reactstrap";
import history from "../Utils/history";
import Loading from "../Loading";
import App from "../App";
import Profile from "../Profile";


export default function AppWrapper(){
  const { isLoading, error } = useAuth0();

  if (error) {
    return <div>Oops... {error.message}</div>;
  }

  if (isLoading) {
    return <Loading />;
  }

  return (
    <Router history={history}>
      <div id="app" className="d-flex flex-column h-100">
        <Container className="flex-grow-1 mt-5">
          <Switch>
            <Route path="/" exact component={App} />
            <Route path="/profile" component={Profile} />
          </Switch>
        </Container>
      </div>
    </Router>
  );
}
