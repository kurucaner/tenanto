export type S3EventName =
  // Object Created Events
  | "s3:ObjectCreated:*"
  | "s3:ObjectCreated:Put"
  | "s3:ObjectCreated:Post"
  | "s3:ObjectCreated:Copy"
  | "s3:ObjectCreated:CompleteMultipartUpload"

  // Object Removed Events
  | "s3:ObjectRemoved:*"
  | "s3:ObjectRemoved:Delete"
  | "s3:ObjectRemoved:DeleteMarkerCreated"

  // Object Restore Events
  | "s3:ObjectRestore:*"
  | "s3:ObjectRestore:Post"
  | "s3:ObjectRestore:Completed"

  // Reduced Redundancy Storage (RRS) Object Lost
  | "s3:ReducedRedundancyLostObject"

  // Replication Events
  | "s3:Replication:*"
  | "s3:Replication:OperationFailedReplication"
  | "s3:Replication:OperationMissedThreshold"
  | "s3:Replication:OperationReplicatedAfterThreshold"
  | "s3:Replication:OperationNotTracked"

  // Lifecycle Transition
  | "s3:LifecycleTransition"
  | "s3:LifecycleExpiration:*"
  | "s3:LifecycleExpiration:Delete"
  | "s3:LifecycleExpiration:DeleteMarkerCreated";

export interface S3NotificationEvent {
  Records: {
    eventName: string;
    s3: {
      object: {
        key: string;
      };
    };
  }[];
}

export interface MultipartUploadResult {
  key: string;
  uploadId: string;
}

export interface ChunkUploadUrl {
  partNumber: number;
  url: string;
}
