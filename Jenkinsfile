pipeline {
    agent any

    options {
        timeout(time: 1, unit: 'HOURS')
        buildDiscarder(logRotator(numToKeepStr: '5'))
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                // Jenkins automatically checks out the repository,
                // but this step is defined for completeness.
                checkout scm
            }
        }

        stage('Build Containers') {
            steps {
                dir('backend') {
                    echo 'Building backend Docker image...'
                    sh 'docker compose build'
                }
            }
        }

        stage('Deploy') {
            steps {
                dir('backend') {
                    echo 'Stopping existing containers...'
                    sh 'docker compose down --remove-orphans'
                    echo 'Starting backend application...'
                    sh 'docker compose up -d'
                }
            }
        }
    }

    post {
        success {
            echo 'Deployment completed successfully!'
        }
        failure {
            echo 'Deployment failed. Please check build logs.'
        }
    }
}
