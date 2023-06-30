import AWS from 'aws-sdk';
import csvParser from 'csv-parser';

export const importDataFromCSV = async (bucketName: string, filePath: string) => {
  const s3 = new AWS.S3();

  const s3Params = {
    Bucket: bucketName,
    Key: filePath
  };

  const s3Stream = s3.getObject(s3Params).createReadStream();

  return new Promise<any[]>((resolve, reject) => {
    const data: any[] = [];

    s3Stream
      .pipe(csvParser())
      .on('data', (rowData: any) => {
        data.push(rowData);
      })
      .on('end', () => {
        console.log('CSV data read successfully');
        resolve(data);
      })
      .on('error', (error: any) => {
        console.error('Error reading CSV:', error);
        reject(error);
      });
  });
};
