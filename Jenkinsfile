pipeline {
    agent any

    environment {
        IMAGE_TAG = "${env.GIT_COMMIT?.take(7) ?: 'latest'}"
        NAMESPACE = 'xpense'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                echo "Building commit: ${IMAGE_TAG}"
            }
        }

        stage('Build & Push Images') {
            parallel {
                stage('Backend') {
                    steps {
                        withCredentials([usernamePassword(
                            credentialsId: 'dockerhub-creds',
                            usernameVariable: 'DOCKER_USER',
                            passwordVariable: 'DOCKER_PASS'
                        )]) {
                            sh '''
                                echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                                docker build -t $DOCKER_USER/xpense-backend:$IMAGE_TAG ./backend
                                docker push $DOCKER_USER/xpense-backend:$IMAGE_TAG
                                docker tag  $DOCKER_USER/xpense-backend:$IMAGE_TAG \
                                            $DOCKER_USER/xpense-backend:latest
                                docker push $DOCKER_USER/xpense-backend:latest
                            '''
                        }
                    }
                }
                stage('Frontend') {
                    steps {
                        withCredentials([usernamePassword(
                            credentialsId: 'dockerhub-creds',
                            usernameVariable: 'DOCKER_USER',
                            passwordVariable: 'DOCKER_PASS'
                        )]) {
                            // VITE_API_URL intentionally omitted — defaults to /api
                            sh '''
                                echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                                docker build -t $DOCKER_USER/xpense-frontend:$IMAGE_TAG ./frontend
                                docker push $DOCKER_USER/xpense-frontend:$IMAGE_TAG
                                docker tag  $DOCKER_USER/xpense-frontend:$IMAGE_TAG \
                                            $DOCKER_USER/xpense-frontend:latest
                                docker push $DOCKER_USER/xpense-frontend:latest
                            '''
                        }
                    }
                }
            }
        }

        stage('Apply Infrastructure') {
            // Uses ~/.kube/config on the Jenkins agent (the kops-managed kubeconfig)
            // If Jenkins is NOT on the cluster admin node, store kubeconfig as a
            // Jenkins "Secret file" credential and bind it with:
            //   withCredentials([file(credentialsId: 'kube-config', variable: 'KUBECONFIG')])
            steps {
                sh '''
                    kubectl apply -f k8s/00-namespace.yaml
                    kubectl apply -f k8s/02-configmap.yaml
                    kubectl apply -f k8s/03-postgres.yaml
                    kubectl apply -f k8s/04-redis.yaml
                    kubectl wait --namespace $NAMESPACE \
                        --for=condition=ready pod -l app=postgres --timeout=120s
                '''
            }
        }

        stage('DB Migration') {
            steps {
                sh '''
                    kubectl delete job db-init -n $NAMESPACE --ignore-not-found
                    kubectl apply -f k8s/05-db-init-job.yaml
                    kubectl wait --namespace $NAMESPACE \
                        --for=condition=complete job/db-init --timeout=60s
                '''
            }
        }

        stage('Deploy') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                        kubectl apply -f k8s/06-backend.yaml
                        kubectl apply -f k8s/07-frontend.yaml
                        kubectl apply -f k8s/08-ingress.yaml

                        kubectl set image deployment/backend \
                            backend=$DOCKER_USER/xpense-backend:$IMAGE_TAG \
                            -n $NAMESPACE

                        kubectl set image deployment/frontend \
                            frontend=$DOCKER_USER/xpense-frontend:$IMAGE_TAG \
                            -n $NAMESPACE
                    '''
                }
            }
        }

        stage('Verify Rollout') {
            steps {
                sh '''
                    kubectl rollout status deployment/backend  -n $NAMESPACE --timeout=120s
                    kubectl rollout status deployment/frontend -n $NAMESPACE --timeout=120s
                    kubectl get pods -n $NAMESPACE
                '''
            }
        }
    }

    post {
        success {
            echo "Deployment successful — image tag: ${IMAGE_TAG}"
        }
        failure {
            echo "Deployment FAILED — rolling back"
            sh '''
                kubectl rollout undo deployment/backend  -n xpense || true
                kubectl rollout undo deployment/frontend -n xpense || true
            '''
        }
        always {
            sh 'docker logout || true'
            sh 'docker image prune -f || true'
        }
    }
}
