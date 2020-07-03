import React, { Component } from "react";
import gql from 'graphql-tag';
import { useQuery } from '@apollo/react-hooks';
import App from '../App'
import { BrowserRouter } from "react-router-dom";

export default class Login extends Component {
  constructor(props) {
    super(props);
    this.state = {
      msg: 'Please fill the information correctly.',
      password: null,
      email: null
    };
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleEmail = this.handleEmail.bind(this);
    this.handlePassword = this.handlePassword.bind(this);
  }

  handleEmail(event){
    this.setState({email: event.target.value});
  }

  handlePassword(event){
    this.setState({password: event.target.value});
  }

  handleSubmit(event) {
    alert(this.state.email+" "+this.state.password);
    return (<BrowserRouter> <App /> </BrowserRouter>);
    // return (<App />);
    // event.preventDefault();
  }

  render() {
      return (
          <form onSubmit={this.handleSubmit}>
              <h3>Log In</h3>
              <div className="form-group">
                  <label>Email address</label>
                  <input type="email" className="form-control" placeholder="Enter email" value={this.state.email} onChange={this.handleEmail}/>
              </div>

              <div className="form-group">
                  <label>Password</label>
                  <input type="password" className="form-control" placeholder="Enter password" value={this.state.password} onChange={this.handlePassword}/>
              </div>

              <div className="form-group">
                  <div className="custom-control custom-checkbox">
                      <input type="checkbox" className="custom-control-input" id="customCheck1" />
                      <label className="custom-control-label" htmlFor="customCheck1">Remember me</label>
                  </div>
              </div>

              <button type="submit" className="btn btn-primary btn-block">Submit</button>
              <p className="forgot-password text-right">
                  Forgot <a href="#">password?</a>
              </p>
          </form>
      );
  }
}
