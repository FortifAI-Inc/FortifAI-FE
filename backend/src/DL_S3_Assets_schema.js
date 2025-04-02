const parquet = require('parquetjs-lite');

const AssetDirectorySchema = new parquet.ParquetSchema({
    AssetType: { type: 'UTF8', optional: false},
    AssetTable: { type: 'UTF8', optional: false}, // the S3 Key for the asset containing this Type
})

const ec2Schema = new parquet.ParquetSchema({
    UniqueId: { type: 'UTF8', optional: false}, // have a standard uniqueId for all assets, each of them will hold the relevant ID from AWS
    IsStale: { type: 'BOOLEAN', optional: false },
    InstanceId: { type: 'UTF8', optional: false },
    InstanceType: { type: 'UTF8', optional: true },
    InstanceState: { type: 'UTF8', optional: true },
    LaunchTime: { type: 'UTF8', optional: true },
    PrivateIpAddress: { type: 'UTF8', optional: true },
    PublicIpAddress: { type: 'UTF8', optional: true },
    SubnetId: { type: 'UTF8', optional: true },
    VpcId: { type: 'UTF8', optional: true },
    Architecture: { type: 'UTF8', optional: true},
    ClientToken: { type: 'UTF8', optional: true},
    ElasticGpuAssociations: { type: 'UTF8', optional: true},
    ElasticInferenceAcceleratorAssociations: { type: 'UTF8', optional: true},
    NetworkInterfaces: { type: 'UTF8', repeated: true}, // for now save only the IfID, later figure out how to store an object
    CpuOptions: { type: 'UTF8', optional: true},
    PlatformDetails: { type: 'UTF8', optional: true},
    IsAI: { type: 'BOOLEAN', optional: true}, // if the instance is an AI instance
    AIDetectionDetails: { type: 'UTF8', optional: true}, // details about the AI instance
    /*,
    securityGroups: { type: 'UTF8', optional: true },
    tags: { type: 'UTF8', optional: true }*/
});
const VpcSchema = new parquet.ParquetSchema({
    UniqueId: { type: 'UTF8', optional: false },
    IsStale: { type: 'BOOLEAN', optional: false },
    VpcId: { type: 'UTF8', optional: false },
    CidrBlock: { type: 'UTF8', optional: false },
    Tags: { type: 'JSON', optional: true }
});
const SubnetSchema = new parquet.ParquetSchema({
    UniqueId: { type: 'UTF8', optional: false },
    IsStale: { type: 'BOOLEAN', optional: false },
    SubnetId: { type: 'UTF8', optional: false },
    SubnetArn: { type: 'UTF8', optional: false },
    CidrBlock: { type: 'UTF8', optional: false },
    AvailabilityZone: { type: 'UTF8', optional: false },
    State: { type: 'UTF8', optional: false },
    VpcId: { type: 'UTF8', optional: false },
    OwnerId: { type: 'UTF8', optional: false },
    Ipv6CidrBlockAssociationSet: { type: 'JSON', optional: true },
    Tags: { type: 'JSON', optional: true }
}); 
const S3Schema = new parquet.ParquetSchema({
    UniqueId: { type: 'UTF8', optional: false },
    IsStale: { type: 'BOOLEAN', optional: false },
    Name: { type: 'UTF8', optional: false },
    CreationDate: { type: 'UTF8', optional: false },
    Tags: { type: 'JSON', optional: true }
});
const IGWSchema = new parquet.ParquetSchema({
    UniqueId: { type: 'UTF8', optional: false },
    IsStale: { type: 'BOOLEAN', optional: false },
    InternetGatewayId: { type: 'UTF8', optional: false },
    VpcId: { type: 'UTF8', optional: true },
    Tags: { type: 'JSON', optional: true }
});
const SGSchema = new parquet.ParquetSchema({
    UniqueId: { type: 'UTF8', optional: false },
    IsStale: { type: 'BOOLEAN', optional: false },
    GroupId: { type: 'UTF8', optional: false },
    VpcId: { type: 'UTF8', optional: false },
    Tags: { type: 'JSON', optional: true }
});
const NISchema = new parquet.ParquetSchema({
    UniqueId: { type: 'UTF8', optional: false },
    IsStale: { type: 'BOOLEAN', optional: false },
    NetworkInterfaceId: { type: 'UTF8', optional: false },
    AvailabilityZone: { type: 'UTF8', optional: false },
    PrivateIpAddress: { type: 'UTF8', optional: false },
    PublicIp: { type: 'UTF8', optional: true },
    Description: { type: 'UTF8', optional: true },
    AttachmentId: { type: 'UTF8', optional: true },
    InstanceId: { type: 'UTF8', optional: true },
    VpcId: { type: 'UTF8', optional: false }, 
    SubnetId: { type: 'UTF8', optional: false },
    GroupId: { type: 'UTF8', optional: true },
    Tags: { type: 'JSON', optional: true }
});
const LambdaSchema = new parquet.ParquetSchema({
    UniqueId: { type: 'UTF8', optional: false },
    IsStale: { type: 'BOOLEAN', optional: false },
    FunctionName: { type: 'UTF8', optional: false },
    Description: { type: 'UTF8', optional: true },
    Role: { type: 'UTF8', optional: false },
    Tags: { type: 'JSON', optional: true }
});
const IAMRoleSchema = new parquet.ParquetSchema({
    UniqueId: { type: 'UTF8', optional: false },
    IsStale: { type: 'BOOLEAN', optional: false },
    RoleId: { type: 'UTF8', optional: false },
    RoleName: { type: 'UTF8', optional: false },
    AssumeRolePolicyDocument: { type: 'UTF8', optional: false },
    Tags: { type: 'JSON', optional: true }
});
const IAMPolicySchema = new parquet.ParquetSchema({
    UniqueId: { type: 'UTF8', optional: false },
    IsStale: { type: 'BOOLEAN', optional: false },
    PolicyId: { type: 'UTF8', optional: false },
    PolicyName: { type: 'UTF8', optional: false },
    AttachmentCount: { type: 'INT32', optional: false },
    PermissionsBoundaryUsageCount: {type: 'INT32', optional: false},
    Document: {type: 'UTF8', optional: false},
    Tags: { type: 'JSON', optional: true }
});
const UserSchema = new parquet.ParquetSchema({
    UniqueId: { type: 'UTF8', optional: false },
    IsStale: { type: 'BOOLEAN', optional: false },
    UserId: { type: 'UTF8', optional: false },
    UserName: { type: 'UTF8', optional: false },
    AccessKeyIds: { type: 'UTF8', repeated: true },
    AttachedPolicyNames: {type: 'UTF8', repeated: true},
    InlinePolicyNames: {type: 'UTF8', repeated: true},
    Tags: { type: 'JSON', optional: true }
});

module.exports = {
    ec2Schema,
    VpcSchema,
    S3Schema,
    IGWSchema,
    SGSchema,
    NISchema,
    LambdaSchema,
    IAMRoleSchema,
    IAMPolicySchema,
    UserSchema,
    AssetDirectorySchema,
    SubnetSchema
};
