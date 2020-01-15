import { CloudWatchLogsDecodedData, CloudWatchLogsEvent, CloudWatchLogsHandler, Context } from "aws-lambda";
import { CW } from "./cloudwatch";
import { Dynamo } from "./dynamodb";
import { Category, CategoryConfiguration, CategoryServiceFactory, LogLevel } from "typescript-logging";
import { ungzip } from "node-gzip";


CategoryServiceFactory.setDefaultConfiguration(new CategoryConfiguration(LogLevel.Info));
export const handlerLogger = new Category("Handler");
export const dynamoLogger = new Category("DynamoDB", handlerLogger);
export const cwLogger = new Category("CloudWatch", handlerLogger);

async function decodeEventData(data: string): Promise<CloudWatchLogsDecodedData> {
  const unzipped = String(await ungzip(Buffer.from(data, "base64")));
  handlerLogger.info(unzipped);
  return JSON.parse(unzipped);
}

/**
 * @param {CloudWatchLogsEvent} event
 * @param {Context} context
 */
export const handler: CloudWatchLogsHandler = async (event: CloudWatchLogsEvent, context: Context): Promise<void> => {
  handlerLogger.info(`context: ${JSON.stringify(context)}`);
  const log: CloudWatchLogsDecodedData = await decodeEventData(event.awslogs.data);
  const cw = new CW();
  if (/\/aws\/lambda\/activities-[\w-]+/.test(log.logGroup)) {
    const dynamo = new Dynamo();
    const [visits, oldVisits, openVisits] = await Promise.all([dynamo.getVisits(), dynamo.getOldVisits(), dynamo.getOpenVisits()]);
    handlerLogger.info(await cw.sendVisits(visits, oldVisits, openVisits));
  }
  handlerLogger.info(await cw.sendTimeouts(log.logGroup, log.logEvents));
};
