#!/bin/bash

# fetch current deployment
DEPLOYMENT_ID=$(aws deploy list-deployments \
    --application-name my-ecs-application \
    --deployment-group-name my-ecs-deployment-group \
    --query 'deployments[0]' \
    --output text)

# fetch deployment status
DEPLOYMENT_STATUS=$(aws deploy get-deployment \
    --deployment-id $DEPLOYMENT_ID \
    --query 'deploymentInfo.status' \
    --output text)

# exit if the deployment is not "ready" yet
if [ $DEPLOYMENT_STATUS != "Ready" ]; then
    echo "Deployment is not ready yet. Exiting."
    echo "Deployment status: " $DEPLOYMENT_STATUS
    exit 0
fi

# continue deployment
echo 'Continuing deployment with deployment id: ' $DEPLOYMENT_ID
aws deploy continue-deployment \
    --deployment-id $DEPLOYMENT_ID \
    --deployment-wait-type READY_WAIT

# https://docs.aws.amazon.com/codedeploy/latest/APIReference/API_ContinueDeployment.html
# READY_WAIT: indicates that the deployment is ready to start shifting traffic.
# TERMINATION_WAIT: indicates that the traffic is shifted, but the original target is not terminated.
