import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as alb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export class AwsEcsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // AWS::EC2::VPC
        const vpc = new cdk.aws_ec2.Vpc(this, 'VPC', {
            maxAzs: 2,
            natGateways: 1,
            vpcName: 'my-vpc'
        });

        // AWS::ElasticLoadBalancingV2::LoadBalancer
        const loadBalancer = new alb.ApplicationLoadBalancer(this, 'ALB', {
            vpc,
            loadBalancerName: 'my-load-balancer',
            internetFacing: true
        });

        // AWS::ElasticLoadBalancingV2::Listener
        const listener = new alb.ApplicationListener(this, 'Listener', {
            loadBalancer,
            port: 80,
            protocol: alb.ApplicationProtocol.HTTP,
            defaultAction: alb.ListenerAction.fixedResponse(404, {
                contentType: 'text/plain',
                messageBody: 'Not Found'
            })
        });

        // AWS::ECSCluster
        const cluster = new ecs.Cluster(this, 'Cluster', {
            vpc,
            clusterName: 'my-cluster'
        });

        // AWS::ECS::TaskDefinition
        const taskDefinition = new ecs.TaskDefinition(this, 'my-task-def', {
            family: 'my-task-def',
            memoryMiB: '512',
            cpu: '256',
            compatibility: ecs.Compatibility.FARGATE,
            networkMode: ecs.NetworkMode.AWS_VPC
        });

        // AWS::ECS::TaskDefinition [container:my-app]
        const container = taskDefinition.addContainer('my-container', {
            containerName: 'my-app',
            image: ecs.ContainerImage.fromRegistry('octopussamples/helloworldwithversion'),
            memoryLimitMiB: 512,
            environment: {
                APPVERSION: 'v9'
            },
            portMappings: [{ containerPort: 4000 }]
        });

        // AWS::ECS::Service
        const fargateService = new ecs.FargateService(this, 'my-service', {
            cluster,
            serviceName: 'my-ecs-service',
            desiredCount: 1,
            taskDefinition,
            vpcSubnets: {
                subnets: vpc.privateSubnets
            },
            deploymentController: {
                type: ecs.DeploymentControllerType.CODE_DEPLOY
            }
        });

        // AWS::ElasticLoadBalancingV2::TargetGroup [blue]
        const blueTargetGroup = new alb.ApplicationTargetGroup(this, 'blue-tg', {
            vpc,
            targetGroupName: 'blue-tg',
            port: 4000,
            protocol: alb.ApplicationProtocol.HTTP,
            healthCheck: {
                path: '/*'
            },
            targets: [fargateService]
        });
        const greenTargetGroup = new alb.ApplicationTargetGroup(this, 'green-tg', {
            vpc,
            targetGroupName: 'green-tg',
            port: 4000,
            protocol: alb.ApplicationProtocol.HTTP,
            healthCheck: {
                path: '/*'
            },
            targets: [fargateService]
        });

        const prodListenerRule = new alb.ApplicationListenerRule(this, 'prod-listener-rule', {
            listener,
            priority: 10,
            conditions: [alb.ListenerCondition.pathPatterns(['/api'])],
            action: alb.ListenerAction.weightedForward([
                { targetGroup: blueTargetGroup, weight: 100 },
                { targetGroup: greenTargetGroup, weight: 0 }
            ])
        });

        const testListener = loadBalancer.addListener('TestListener', {
            port: 8080,
            protocol: alb.ApplicationProtocol.HTTP,
            defaultAction: alb.ListenerAction.fixedResponse(404, {
                contentType: 'text/plain',
                messageBody: 'Not Found'
            })
        });
        const testListenerRule = new alb.ApplicationListenerRule(this, 'test-listener-rule', {
            listener: testListener,
            priority: 10,
            conditions: [alb.ListenerCondition.pathPatterns(['/test'])],
            action: alb.ListenerAction.forward([greenTargetGroup])
        });

        const customDeploymentConfig = new codedeploy.EcsDeploymentConfig(this, 'CustomDeploymentConfig', {
            deploymentConfigName: 'CustomDeploymentConfig',
            trafficRouting: codedeploy.TrafficRouting.timeBasedLinear({
                interval: cdk.Duration.minutes(1),
                percentage: 20
            })
        });

        // alarm on 404 errors
        const alarm = new cloudwatch.Alarm(this, 'Alarm', {
            alarmName: 'my-alarm',
            metric: new cloudwatch.Metric({
                namespace: 'AWS/ApplicationELB',
                metricName: 'HTTPCode_ELB_4XX_Count',
                dimensionsMap: {
                    LoadBalancer: loadBalancer.loadBalancerFullName
                },
                statistic: 'sum',
                period: cdk.Duration.minutes(1)
            }),
            threshold: 5,
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        });

        // deployment group
        // AWS::CodeDeploy::Application
        const ecsDeploymentGroup = new codedeploy.EcsDeploymentGroup(this, 'EcsDeploymentGroup', {
            application: new codedeploy.EcsApplication(this, 'ecs-app', {
                applicationName: 'my-ecs-application'
            }),
            deploymentGroupName: 'my-ecs-deployment-group',
            deploymentConfig: customDeploymentConfig,
            service: fargateService,
            alarms: [alarm],
            autoRollback: {
                failedDeployment: true,
                stoppedDeployment: true
            },
            blueGreenDeploymentConfig: {
                blueTargetGroup,
                greenTargetGroup,
                listener,
                testListener,
                // terminationWaitTime: cdk.Duration.minutes(10),
                deploymentApprovalWaitTime: cdk.Duration.minutes(10)
            }
        });

        // Outputs
        // alb url
        new cdk.CfnOutput(this, 'LoadBalancerDNS', {
            value: loadBalancer.loadBalancerDnsName,
            description: 'Load Balancer DNS'
        });
        // task definition arn
        new cdk.CfnOutput(this, 'TaskDefinitionArn', {
            value: taskDefinition.taskDefinitionArn,
            description: 'Task Definition Arn'
        });
    }
}
