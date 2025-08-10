import { writeFile } from 'fs';
export class DataFilesWriter {
    constructor() { }

    WriteToFile(outputFolder: string, outputFileName: string, data: any): void {
        const filePath = `${outputFolder}/${outputFileName}`;
        writeFile(
            filePath,
            JSON.stringify(data),
            "utf8",
            result => {
                if (result) {
                    // console.log(result);
                } else {
                    console.log(`ci file written to ${filePath}`);
                }
            });
    }
}
