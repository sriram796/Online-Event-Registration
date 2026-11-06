# Online Event Registration and Management System

## Project Description

An online platform that allows students to explore college events,
register for events and manage their registrations.

Administrators can create events and view registered participants.

## Features

1. Student registration and login
2. Event listing
3. Event registration
4. Participant management
5. Admin dashboard
6. Registration confirmation

## Technologies Used

Frontend:
- HTML
- CSS
- JavaScript

Backend:
- Node.js
- Express.js

Database:
- JSON file storage

DevOps:
- Git
- GitHub
- Docker
- Jenkins
- Kubernetes
- Selenium
- Jest

## Installation

Install dependencies:

npm install

Start the application:

npm start

Open:

http://localhost:3000

## Testing

Run unit tests:

npm test

Run Selenium tests:

npm run test:e2e

## Docker

Build image:

docker build -t online-event-registration .

Run container:

docker run -p 3000:3000 \
-v event-data:/app/data \
online-event-registration

## Kubernetes

Create the session secret:

kubectl create secret generic event-app-secret \
--from-literal=session-secret="replace-with-a-long-random-secret"

Deploy application:

kubectl apply -f k8s/deployment.yaml

kubectl apply -f k8s/service.yaml

Check pods:

kubectl get pods

Check services:

kubectl get services

## Jenkins

Configure a Jenkins Pipeline job connected to
the GitHub repository.

Add Docker Hub credentials with ID:

dockerhub-credentials

Update the Docker Hub username in Jenkinsfile.

The pipeline installs dependencies, runs tests,
builds the Docker image and pushes it on the main branch.

## Important Production Considerations

This starter uses JSON storage for a simple demonstration.
It is not suitable for concurrent multi-replica production use.

Use PostgreSQL or MySQL, shared storage, secure session
storage, HTTPS and managed secrets for production.