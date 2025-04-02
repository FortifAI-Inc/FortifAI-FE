declare module 'react-aws-icons' {
  import { FC, SVGProps } from 'react';

  interface AWSIconProps extends SVGProps<SVGSVGElement> {
    width?: number;
    height?: number;
  }

  export const S3Icon: FC<AWSIconProps>;
  export const VPCIcon: FC<AWSIconProps>;
  export const SubnetIcon: FC<AWSIconProps>;
  export const EC2Icon: FC<AWSIconProps>;
  export const SecurityGroupIcon: FC<AWSIconProps>;
  export const NetworkInterfaceIcon: FC<AWSIconProps>;
  export const InternetGatewayIcon: FC<AWSIconProps>;
  export const IAMRoleIcon: FC<AWSIconProps>;
  export const IAMPolicyIcon: FC<AWSIconProps>;
  export const IAMUserIcon: FC<AWSIconProps>;
} 