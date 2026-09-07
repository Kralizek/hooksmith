/** Amazon SNS HTTP notification shape. */
export interface SnsNotification {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion?: string;
  Signature?: string;
  SigningCertURL?: string;
  UnsubscribeURL?: string;
  SubscribeURL?: string;
  Token?: string;
  MessageAttributes?: Record<string, unknown>;
}
