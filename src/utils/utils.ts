import path from 'path';
import fs from 'fs';
import Papa from 'papaparse';
import XLSX from 'xlsx';

export type DataPoint = {
    [key: string]: any;
}

export type DataRow = { [key: string]: any };
export type DataFrame = DataRow[];

export function getExcelSheets(filePath: string): { [key: string]: DataFrame } {
    const workbook = XLSX.readFile(filePath);
    const sheets: { [key: string]: DataFrame } = {};

    workbook.SheetNames.forEach(sheetName => {
        if (sheetName.startsWith('out_')) {
            sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        }
    });
    return sheets;
}

export function getCsvOutputFolderPath(): string {
    const folderName = path.join('resources', 'output');
    if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName, { recursive: true });
    }
    return folderName;
}

// Convert a JSON array to CSV string
export function jsonToCsv(jsonData: any[]): string {
    return Papa.unparse(jsonData);
}

export const processDf = (df: DataFrame, id_cols: string[], idOffset: number): DataFrame => {
    return df.map(row => {
        const newRow: { [key: string]: any } = {};
        for (const key in row) {
            if (key.startsWith('calc_') || key.startsWith('tmp_')) continue;

            newRow[key] = row[key];

            if (newRow[key] === 'TRUE') {
                newRow[key] = true;
            }
            else if (newRow[key] === 'FALSE') {
                newRow[key] = false;
            }
            if (id_cols.includes(key)) {
                // only extract the number part from the ID
                // for example, if the ID is g_t_3, extract 3
                newRow[key] = parseInt(newRow[key].slice(idOffset));
            }
        }

        return newRow;
    });
};

export const writeFileSync = (outputPath: string, data: string) => {
    const folderName = path.dirname(outputPath);
    if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName, { recursive: true });
    }
    fs.writeFileSync(outputPath, data);
}

