import AWS from 'aws-sdk';
import csvParser from 'csv-parser';

export const importDataFromCSV = async (bucketName: string, filePath: string) => {
  const s3 = new AWS.S3();
const tableName = 'customersDB';


  const s3Params = {
    Bucket: bucketName,
    Key: filePath
  };

  const s3Stream = s3.getObject(s3Params).createReadStream();

  return new Promise<void>((resolve, reject) => {
    const dynamoDB = new AWS.DynamoDB.DocumentClient();

    s3Stream
      .pipe(csvParser())
      .on('data', (data: any) => {
        const params = {
          TableName: tableName,
          Item: data // Assuming the data object matches the DynamoDB table structure
        };

        dynamoDB.put(params, (error, result) => {
          if (error) {
            console.error('Error adding item to DynamoDB:', error);
            reject(error);
          }
        });
      })
      .on('end', () => {
        console.log('CSV data imported successfully');
        resolve();
      })
      .on('error', (error: any) => {
        console.error('Error reading CSV:', error);
        reject(error);
      });
  });
};
