export type SolaceBridgeConfigType = {
    bridgeConfig: SolaceBridgeConfigUrlType[]
}


export type SolaceBridgeConfigUrlType = {
    queueName: string,
    targetURL: string,
    maxRetry: number,
    ackOn4xx: boolean
};

