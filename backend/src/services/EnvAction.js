const { EC2Client, DescribeInstancesCommand, StopInstancesCommand, StartInstancesCommand, DetachNetworkInterfaceCommand, AttachNetworkInterfaceCommand, DescribeSubnetsCommand, CreateNetworkInterfaceCommand, ModifyInstanceAttributeCommand, CreateImageCommand, RunInstancesCommand, TerminateInstancesCommand, DescribeImagesCommand, DescribeAddressesCommand, AssociateAddressCommand, DisassociateAddressCommand } = require('@aws-sdk/client-ec2');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configure AWS SDK v3
const ec2Client = new EC2Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function waitForInstanceState(instanceId, targetState) {
  while (true) {
    const describeCommand = new DescribeInstancesCommand({
      InstanceIds: [instanceId]
    });
    const response = await ec2Client.send(describeCommand);
    const instance = response.Reservations?.[0]?.Instances?.[0];
    
    if (instance?.State?.Name === targetState) {
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before checking again
  }
}

async function waitForImageAvailable(imageId) {
  while (true) {
    const describeCommand = new DescribeImagesCommand({
      ImageIds: [imageId]
    });
    const response = await ec2Client.send(describeCommand);
    const image = response.Images?.[0];
    
    if (image?.State === 'available') {
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before checking again
  }
}

async function handleElasticIP(instanceId, newInstanceId) {
  try {
    // Get all elastic IPs
    const describeAddressesCommand = new DescribeAddressesCommand({});
    const addressesResponse = await ec2Client.send(describeAddressesCommand);
    
    // Find elastic IP associated with the original instance
    const elasticIP = addressesResponse.Addresses?.find(addr => 
      addr.InstanceId === instanceId
    );

    if (elasticIP) {
      console.log(`Found elastic IP ${elasticIP.PublicIp} associated with instance ${instanceId}`);
      
      // Disassociate from original instance
      console.log('Disassociating elastic IP from original instance...');
      const disassociateCommand = new DisassociateAddressCommand({
        AssociationId: elasticIP.AssociationId
      });
      await ec2Client.send(disassociateCommand);

      // Wait a moment for the disassociation to complete
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Associate with new instance
      console.log(`Associating elastic IP with new instance ${newInstanceId}...`);
      const associateCommand = new AssociateAddressCommand({
        AllocationId: elasticIP.AllocationId,
        InstanceId: newInstanceId
      });
      await ec2Client.send(associateCommand);
    }
  } catch (error) {
    console.error('Error handling elastic IP:', error);
    // Don't throw the error as this is not critical for the main operation
  }
}

async function relocateEC2BetweenVPCs(instanceId, destinationVpcId) {
  try {
    console.log(`Starting relocation of instance ${instanceId} to VPC ${destinationVpcId}`);

    // Get the EC2 instance details
    const describeCommand = new DescribeInstancesCommand({
      InstanceIds: [instanceId]
    });
    const describeResponse = await ec2Client.send(describeCommand);

    if (!describeResponse.Reservations?.[0]?.Instances?.[0]) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    const instance = describeResponse.Reservations[0].Instances[0];
    const currentVpcId = instance.VpcId;
    
    if (currentVpcId === destinationVpcId) {
      throw new Error('Instance is already in the target VPC');
    }

    // Stop the instance
    console.log(`Stopping instance ${instanceId}`);
    const stopCommand = new StopInstancesCommand({
      InstanceIds: [instanceId]
    });
    await ec2Client.send(stopCommand);

    // Wait for the instance to stop
    console.log('Waiting for instance to stop...');
    await waitForInstanceState(instanceId, 'stopped');

    // Create an AMI from the instance
    console.log('Creating AMI from instance...');
    const createImageCommand = new CreateImageCommand({
      InstanceId: instanceId,
      Name: `relocation-ami-${instanceId}-${Date.now()}`,
      Description: `AMI created for instance ${instanceId} relocation`,
      NoReboot: true
    });
    const createImageResponse = await ec2Client.send(createImageCommand);
    const imageId = createImageResponse.ImageId;

    // Wait for the AMI to be available
    console.log('Waiting for AMI to be available...');
    await waitForImageAvailable(imageId);

    // Get the instance's availability zone
    const instanceAz = instance.Placement.AvailabilityZone;

    // Find a subnet in the same AZ in the destination VPC
    const describeSubnetsCommand = new DescribeSubnetsCommand({
      Filters: [
        {
          Name: 'vpc-id',
          Values: [destinationVpcId]
        },
        {
          Name: 'availability-zone',
          Values: [instanceAz]
        }
      ]
    });
    const subnetsResponse = await ec2Client.send(describeSubnetsCommand);

    if (!subnetsResponse.Subnets?.[0]) {
      throw new Error(`No subnets found in VPC ${destinationVpcId} for availability zone ${instanceAz}`);
    }

    const newSubnetId = subnetsResponse.Subnets[0].SubnetId;

    // Get the IAM role from the original instance
    const iamRole = instance.IamInstanceProfile?.Arn;
    console.log(`Original instance IAM role: ${iamRole || 'None'}`);

    // Get the key pair from the original instance
    const keyPairName = instance.KeyName;
    console.log(`Original instance key pair: ${keyPairName || 'None'}`);

    // Prepare the RunInstances command parameters
    const runInstancesParams = {
      ImageId: imageId,
      InstanceType: instance.InstanceType,
      SubnetId: newSubnetId,
      MinCount: 1,
      MaxCount: 1,
      TagSpecifications: [
        {
          ResourceType: 'instance',
          Tags: instance.Tags || []
        }
      ]
    };

    // Add IAM role if it exists
    if (iamRole) {
      // Extract the role name from the ARN
      const roleName = iamRole.split('/').pop();
      runInstancesParams.IamInstanceProfile = {
        Name: roleName
      };
      console.log(`Adding IAM role ${roleName} to new instance`);
    }

    // Add key pair if it exists
    if (keyPairName) {
      runInstancesParams.KeyName = keyPairName;
      console.log(`Adding key pair ${keyPairName} to new instance`);
    }

    // Launch a new instance from the AMI in the destination VPC
    console.log('Launching new instance in destination VPC...');
    const runInstancesCommand = new RunInstancesCommand(runInstancesParams);
    const runInstancesResponse = await ec2Client.send(runInstancesCommand);
    const newInstanceId = runInstancesResponse.Instances[0].InstanceId;

    // Wait for the new instance to be running
    console.log('Waiting for new instance to start...');
    await waitForInstanceState(newInstanceId, 'running');

    // Handle elastic IP reassignment
    await handleElasticIP(instanceId, newInstanceId);

    return {
      success: true,
      message: `Successfully relocated instance ${instanceId} to VPC ${destinationVpcId}`,
      newInstanceId,
      imageId,
      originalInstanceId: instanceId
    };

  } catch (error) {
    console.error('Error in relocateEC2BetweenVPCs:', error);
    throw error;
  }
}

module.exports = {
  relocateEC2BetweenVPCs
};