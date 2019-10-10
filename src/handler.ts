import { Context, Handler } from "aws-lambda";
import { MetricsResponse } from "handler";
import { CW } from "./cloudwatch";
import { Dynamo } from "./dynamodb";
import { Category, CategoryConfiguration, CategoryServiceFactory, LogLevel } from "typescript-logging";

CategoryServiceFactory.setDefaultConfiguration(new CategoryConfiguration(LogLevel.Info));
export const handlerLogger = new Category("Handler");
export const dynamoLogger = new Category("DynamoDB", handlerLogger);
export const cwLogger = new Category("CloudWatch", handlerLogger);

/**
 * @param {object} event
 * @param {Context} context
 */
export const handler: Handler<object, MetricsResponse> = async (event: object, context: Context): Promise<MetricsResponse> => {
    handlerLogger.info(`event: ${JSON.stringify(event)}`);
    handlerLogger.info(`context: ${JSON.stringify(context)}`);
    const dynamo = new Dynamo();
    const visits = await Promise.all([dynamo.getVisits(), dynamo.getOldVisits()]);
    return { message: await new CW().sendMetrics(visits[0], visits[1]) };
};
