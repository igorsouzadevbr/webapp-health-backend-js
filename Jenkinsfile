pipeline {
    agent any
 
    stages {
        stage('Checkout') {
            steps {
                script {
                    git branch: 'develop', url: 'https://seu-repositorio-git.git'
                }
            }
        }
        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }
        
        stage('Deploy') {
            steps {
                sh './index.js'
            }
        }
    }
}
