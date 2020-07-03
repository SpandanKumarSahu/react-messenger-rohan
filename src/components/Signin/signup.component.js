import React, { Component } from "react";
import { HttpLink, InMemoryCache, gql } from "apollo-boost";
import ApolloClient from "apollo-client";

export default class SignUp extends Component {
  constructor(props) {
    super(props);
    this.state = {
      msg: 'Please fill the information correctly.',
      name: null,
      password: null,
      email: null
    };
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleName = this.handleName.bind(this);
    this.handleEmail = this.handleEmail.bind(this);
    this.handlePassword = this.handlePassword.bind(this);
  }

  handleName(event){
    this.setState({name: event.target.value});
  }

  handleEmail(event){
    this.setState({email: event.target.value});
  }

  handlePassword(event){
    this.setState({password: event.target.value});
  }

  handleSubmit(event) {
    const client = new ApolloClient({
        link: new HttpLink({
          uri: "http://localhost:8080/v1/graphql"
        }),
        cache: new InMemoryCache(),
        connectToDevTools: true
    });
    const CHECK_USER_EXISTS = gql`
      query checkUserExists($email: String){
          Users(where: {
            emailid : {
              _eq : $email
            }
          }){
            name
          }
      }
    `
    client.query({
      query: CHECK_USER_EXISTS,
      variables: {
        email: this.state.email
      }
    }).then(result => {
      if(result['data']['Users'].length > 0){
        console.log(result['data']['Users'][0]['name']);
      } else {
        console.log("Hello");
      }
    });
  }

  render() {
      return (
          <form onSubmit={this.handleSubmit}>
              <h3>Sign Up</h3>

              <div className="form-group">
                  <label>Name</label>
                  <input type="text" className="form-control" placeholder="Enter Name" name="Name" value={this.state.name} onChange={this.handleName}/>
              </div>

              <div className="form-group">
                  <label>Email address</label>
                  <input type="email" className="form-control" placeholder="Enter email" name="Email" value={this.state.email} onChange={this.handleEmail}/>
              </div>

              <div className="form-group">
                  <label>Password</label>
                  <input type="password" className="form-control" placeholder="Enter password" name="Password" value={this.state.password} onChange={this.handlePassword}/>
              </div>

              <button type="submit" className="btn btn-primary btn-block">Sign Up</button>
              <p className="forgot-password text-right">
                  Already registered <a href="/log-in">sign in?</a>
              </p>
          </form>
      );
  }
}
