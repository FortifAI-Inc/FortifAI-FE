const AWS = require('aws-sdk');
import type { NetworkInterface } from 'aws-sdk/clients/ec2';

const ec2Client = new AWS.EC2();

interface RelocateEC2Result {
  success: boolean;
  message: string;
  newNetworkInterfaceId: string;
}

export async function relocateEC2BetweenVPCs(
  instanceId: string,
  destinationVpcId: string
): Promise<RelocateEC2Result> {
  try {
    // Get the EC2 instance details
    const instance = await ec2Client.describeInstances({
      InstanceIds: [instanceId]
    }).promise();

    if (!instance.Reservations?.[0]?.Instances?.[0]) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    const currentInstance = instance.Reservations[0].Instances[0];
    
    // Get the primary network interface
    const primaryNI = currentInstance.NetworkInterfaces?.find((ni: NetworkInterface) => ni.Attachment?.DeviceIndex === 0);
    if (!primaryNI) {
      throw new Error('No primary network interface found');
    }

    const sourceAZ = primaryNI.AvailabilityZone;
    if (!sourceAZ) {
      throw new Error('No availability zone found for primary network interface');
    }

    // Find available network interfaces in destination VPC
    const { NetworkInterfaces: availableNIs } = await ec2Client.describeNetworkInterfaces({
      Filters: [
        { Name: 'vpc-id', Values: [destinationVpcId] },
        { Name: 'status', Values: ['available'] },
        { Name: 'availability-zone', Values: [sourceAZ] }
      ]
    }).promise();

    if (!availableNIs?.length) {
      throw new Error(`No available network interfaces found in VPC ${destinationVpcId} in AZ ${sourceAZ}`);
    }

    // Stop the instance
    await ec2Client.stopInstances({
      InstanceIds: [instanceId]
    }).promise();

    // Wait for instance to stop
    await ec2Client.waitFor('instanceStopped', {
      InstanceIds: [instanceId]
    }).promise();

    // Detach current network interface
    if (!primaryNI.Attachment?.AttachmentId) {
      throw new Error('No attachment ID found for primary network interface');
    }

    await ec2Client.detachNetworkInterface({
      AttachmentId: primaryNI.Attachment.AttachmentId
    }).promise();

    // Attach new network interface
    await ec2Client.attachNetworkInterface({
      NetworkInterfaceId: availableNIs[0].NetworkInterfaceId!,
      InstanceId: instanceId,
      DeviceIndex: 0
    }).promise();

    // Start the instance
    await ec2Client.startInstances({
      InstanceIds: [instanceId]
    }).promise();

    return {
      success: true,
      message: `Successfully relocated instance ${instanceId} to VPC ${destinationVpcId}`,
      newNetworkInterfaceId: availableNIs[0].NetworkInterfaceId!
    };

  } catch (error) {
    console.error('Error relocating EC2 instance:', error);
    throw error;
  }
} 