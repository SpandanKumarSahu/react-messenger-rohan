import React from 'react';
import ReactDOM from 'react-dom';
import AppWrapper from './components/AppWrapper';
import { Route } from "react-router-dom";
// import Signin from './components/Signin'
import * as serviceWorker from './serviceWorker';

import { Auth0Provider } from "@auth0/auth0-react";
import config from "./auth_config.json";
import history from "./components/Utils/history";

const onRedirectCallback = (appState) => {
  history.push(
    appState && appState.returnTo
      ? appState.returnTo
      : window.location.pathname
  );
};

ReactDOM.render(
  <Auth0Provider
    domain={config.domain}
    clientId={config.clientId}
    audience={config.audience}
    scope={config.scope}
    redirectUri={window.location.origin}
    onRedirectCallback={onRedirectCallback}
    cacheLocation={config.cacheLocation}
  >
    <AppWrapper />
  </Auth0Provider>,
  document.getElementById("root")
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
