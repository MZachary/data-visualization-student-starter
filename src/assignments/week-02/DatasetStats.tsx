import { useEffect, useMemo, useState } from 'react';
import { csvParse } from 'd3-dsv';

interface EnergyRow {
  period: string;
  respondent: string;
  'respondent-name': string;
  fueltype: string;
  'type-name': string;
  value: number;
  'value-units': string;
}

const DATA_URL = `${import.meta.env.BASE_URL}data/eia_generation.csv`;

export function LoadingAndSummarizingData() {
  const [data, setData] = useState<EnergyRow[] | null>(null);

  useEffect(() => {
    fetch(DATA_URL)
      .then((response) => response.text())
      .then((text) => {
        const parsed = csvParse(text);

        const rows: EnergyRow[] = parsed.map((row) => ({
          period: row.period,
          respondent: row.respondent,
          'respondent-name': row['respondent-name'],
          fueltype: row.fueltype,
          'type-name': row['type-name'],
          value: Number(row.value),
          'value-units': row['value-units'],
        }));

        setData(rows);
      })
      .catch((error) => {
        console.error('Failed to load data:', error);
      });
  }, []);

  const summary = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    return {
      rows: data.length,
      columns: Object.keys(data[0]).length,
      balancingAuthorities: new Set(data.map((row) => row.respondent)).size,
      fuelTypes: new Set(data.map((row) => row.fueltype)).size,
    };
  }, [data]);

  if (!summary) {
    return <p>Loading dataset...</p>;
  }

  return (
    <div>
      <h1>EIA Electricity Generation Dataset</h1>

      <p>Rows: {summary.rows}</p>
      <p>Columns: {summary.columns}</p>
      <p>Balancing authorities: {summary.balancingAuthorities}</p>
      <p>Fuel types: {summary.fuelTypes}</p>
    </div>
  );
}
