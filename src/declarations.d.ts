declare module 'web-push' {
  interface VapidKeys {
    publicKey: string;
    privateKey: string;
  }

  function generateVAPIDKeys(): VapidKeys;
  function setVapidDetails(
    email: string,
    publicKey: string,
    privateKey: string
  ): void;
  function sendNotification(
    subscription: any,
    payload: string | Buffer,
    options?: any
  ): Promise<any>;

  export { generateVAPIDKeys, setVapidDetails, sendNotification };
}
