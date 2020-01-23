import { CloudWatchLogsDecodedData, FirehoseTransformationEvent, FirehoseTransformationResult } from "aws-lambda";
import { CW } from "./cloudwatch";
import { Dynamo } from "./dynamodb";
import { Category, CategoryConfiguration, CategoryServiceFactory, LogLevel } from "typescript-logging";
import { ungzip } from "pako";
import RE2 from "re2";


CategoryServiceFactory.setDefaultConfiguration(new CategoryConfiguration(LogLevel.Info));
export const handlerLogger = new Category("Handler");
export const dynamoLogger = new Category("DynamoDB", handlerLogger);
export const cwLogger = new Category("CloudWatch", handlerLogger);

async function decodeEventData(data: string): Promise<CloudWatchLogsDecodedData> {
  const unzipped = Buffer.from(ungzip(Buffer.from(data, "base64"))).toString();
  handlerLogger.info(unzipped);
  return JSON.parse(unzipped);
}

/**
 * @param {FirehoseTransformationEvent} event The expected event from Firehose
 * @returns {FirehoseTransformationResult}
 */
export const handler = async (event: FirehoseTransformationEvent): Promise<FirehoseTransformationResult> => {
  const logs: CloudWatchLogsDecodedData[] = await Promise.all(event.records.map((record) => {
    return decodeEventData(record.data);
  }));

  const cw = new CW();
  const dynamo = new Dynamo();
  const promises: Promise<void>[] = [];

  try {
    for (const log of logs) {
      if (new RE2(/\/aws\/lambda\/activities-[\w-]+/).test(log.logGroup)) {
        const [visits, oldVisits, openVisits] = await Promise.all([dynamo.getVisits(), dynamo.getOldVisits(), dynamo.getOpenVisits()]);
        promises.push(cw.sendVisits(visits, oldVisits, openVisits));
      }
      promises.push(cw.sendTimeouts(log.logGroup, log.logEvents));
    }
    await Promise.all(promises);
    return {
      records: event.records.map((record) => ({
        recordId: record.recordId,
        result: "Ok",
        data: record.data
      }))
    } as FirehoseTransformationResult;
  } catch (e) {
    return {
      records: event.records.map((record) => ({
        recordId: record.recordId,
        result: "ProcessingFailed",
        data: record.data
      }))
    } as FirehoseTransformationResult;
  }
};
