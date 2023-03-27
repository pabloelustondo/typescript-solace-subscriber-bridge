export type SolaceBridgeConfigType = {
    bridgeConfig: 
        {
            queueName: string,
            targetURL: string,
            maxRetry: number,
            ackOn4xx: boolean
        }[]
}