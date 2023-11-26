#!/bin/bash

aws deploy create-deployment \
    --application-name my-ecs-application \
    --deployment-group-name my-ecs-deployment-group \
    --revision file://./appspec.json

# can override deployment config with
# --deployment-config-name CodeDeployDefault.ECSLinear10PercentEvery1Minutes
