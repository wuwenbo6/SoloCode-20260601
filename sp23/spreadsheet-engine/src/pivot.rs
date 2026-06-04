use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use crate::excel::{PivotTableConfig, PivotTableResult, PivotAggregation, parse_cell_value, is_numeric};

pub struct PivotTableEngine;

impl PivotTableEngine {
    pub fn new() -> Self {
        PivotTableEngine
    }

    pub fn generate_pivot_table(
        &self,
        config: &PivotTableConfig,
        cells: &HashMap<String, String>,
    ) -> PivotTableResult {
        let data = self.extract_data(&config.data_range, cells);
        if data.is_empty() {
            return PivotTableResult {
                row_headers: Vec::new(),
                column_headers: Vec::new(),
                values: Vec::new(),
                grand_total_row: Vec::new(),
                grand_total_column: Vec::new(),
                grand_total: String::new(),
            };
        }

        let headers = &data[0];
        let rows = &data[1..];

        let row_indices: Vec<usize> = config.rows.iter()
            .filter_map(|r| headers.iter().position(|h| h == r))
            .collect();
        
        let col_indices: Vec<usize> = config.columns.iter()
            .filter_map(|c| headers.iter().position(|h| h == c))
            .collect();
        
        let value_indices: Vec<(usize, PivotAggregation)> = config.values.iter()
            .filter_map(|v| {
                headers.iter().position(|h| h == &v.field)
                    .map(|idx| (idx, v.function.clone()))
            })
            .collect();

        let mut unique_rows: Vec<Vec<String>> = Vec::new();
        let mut unique_cols: Vec<Vec<String>> = Vec::new();
        let mut value_map: HashMap<(Vec<String>, Vec<String>), Vec<Vec<f64>>> = HashMap::new();

        for row in rows {
            let row_key: Vec<String> = row_indices.iter().map(|&i| row.get(i).cloned().unwrap_or_default()).collect();
            let col_key: Vec<String> = col_indices.iter().map(|&i| row.get(i).cloned().unwrap_or_default()).collect();

            if !row_key.is_empty() && !unique_rows.contains(&row_key) {
                unique_rows.push(row_key.clone());
            }
            if !col_key.is_empty() && !unique_cols.contains(&col_key) {
                unique_cols.push(col_key.clone());
            }

            let values: Vec<f64> = value_indices.iter()
                .map(|&(idx, _)| row.get(idx).map(|v| parse_cell_value(v)).unwrap_or(0.0))
                .collect();

            value_map.entry((row_key, col_key))
                .or_insert_with(|| vec![Vec::new(); value_indices.len()])
                .iter_mut()
                .enumerate()
                .for_each(|(i, v)| v.push(values[i]));
        }

        unique_rows.sort();
        unique_cols.sort();

        let row_headers: Vec<String> = unique_rows.iter()
            .map(|r| r.join(" - "))
            .collect();
        
        let column_headers: Vec<String> = unique_cols.iter()
            .map(|c| c.join(" - "))
            .collect();

        let mut result_values: Vec<Vec<String>> = Vec::new();
        for row_key in &unique_rows {
            let mut row_values: Vec<String> = Vec::new();
            for col_key in &unique_cols {
                let key = (row_key.clone(), col_key.clone());
                let vals = value_map.get(&key).unwrap_or(&vec![Vec::new(); value_indices.len()]);
                let aggregated: Vec<String> = vals.iter().zip(value_indices.iter())
                    .map(|(v, (_, agg))| self.aggregate(v, agg))
                    .collect();
                row_values.push(aggregated.join(" / "));
            }
            result_values.push(row_values);
        }

        let grand_total_row: Vec<String> = if !value_indices.is_empty() {
            unique_cols.iter().map(|col_key| {
                let totals: Vec<f64> = value_indices.iter().map(|_| 0.0).collect();
                let count: Vec<usize> = value_indices.iter().map(|_| 0).collect();
                let (sum, count): (Vec<f64>, Vec<usize>) = unique_rows.iter()
                    .fold((totals, count), |(mut sum, mut count), row_key| {
                        let key = (row_key.clone(), col_key.clone());
                        if let Some(vals) = value_map.get(&key) {
                            for (i, v) in vals.iter().enumerate() {
                                for num in v {
                                    sum[i] += num;
                                    count[i] += 1;
                                }
                            }
                        }
                        (sum, count)
                    });
                sum.iter().zip(count.iter()).zip(value_indices.iter())
                    .map(|((&s, &c), (_, agg))| match agg {
                        PivotAggregation::Average => if c > 0 { format!("{}", s / c as f64) } else { "0".to_string() },
                        PivotAggregation::Count => format!("{}", c),
                        _ => format!("{}", s),
                    })
                    .collect::<Vec<_>>()
                    .join(" / ")
            }).collect()
        } else {
            Vec::new()
        };

        let grand_total_column: Vec<String> = if !value_indices.is_empty() {
            unique_rows.iter().map(|row_key| {
                let totals: Vec<f64> = value_indices.iter().map(|_| 0.0).collect();
                let count: Vec<usize> = value_indices.iter().map(|_| 0).collect();
                let (sum, count): (Vec<f64>, Vec<usize>) = unique_cols.iter()
                    .fold((totals, count), |(mut sum, mut count), col_key| {
                        let key = (row_key.clone(), col_key.clone());
                        if let Some(vals) = value_map.get(&key) {
                            for (i, v) in vals.iter().enumerate() {
                                for num in v {
                                    sum[i] += num;
                                    count[i] += 1;
                                }
                            }
                        }
                        (sum, count)
                    });
                sum.iter().zip(count.iter()).zip(value_indices.iter())
                    .map(|((&s, &c), (_, agg))| match agg {
                        PivotAggregation::Average => if c > 0 { format!("{}", s / c as f64) } else { "0".to_string() },
                        PivotAggregation::Count => format!("{}", c),
                        _ => format!("{}", s),
                    })
                    .collect::<Vec<_>>()
                    .join(" / ")
            }).collect()
        } else {
            Vec::new()
        };

        let grand_total = if !value_indices.is_empty() {
            let totals: Vec<f64> = value_indices.iter().map(|_| 0.0).collect();
            let count: Vec<usize> = value_indices.iter().map(|_| 0).collect();
            let (sum, count): (Vec<f64>, Vec<usize>) = unique_rows.iter()
                .fold((totals, count), |(sum, count), row_key| {
                    unique_cols.iter().fold((sum, count), |(mut sum, mut count), col_key| {
                        let key = (row_key.clone(), col_key.clone());
                        if let Some(vals) = value_map.get(&key) {
                            for (i, v) in vals.iter().enumerate() {
                                for num in v {
                                    sum[i] += num;
                                    count[i] += 1;
                                }
                            }
                        }
                        (sum, count)
                    })
                });
            sum.iter().zip(count.iter()).zip(value_indices.iter())
                .map(|((&s, &c), (_, agg))| match agg {
                    PivotAggregation::Average => if c > 0 { format!("{}", s / c as f64) } else { "0".to_string() },
                    PivotAggregation::Count => format!("{}", c),
                    _ => format!("{}", s),
                })
                .collect::<Vec<_>>()
                .join(" / ")
        } else {
            String::new()
        };

        PivotTableResult {
            row_headers,
            column_headers,
            values: result_values,
            grand_total_row,
            grand_total_column,
            grand_total,
        }
    }

    fn aggregate(&self, values: &[f64], function: &PivotAggregation) -> String {
        if values.is_empty() {
            return "0".to_string();
        }
        match function {
            PivotAggregation::Sum => format!("{}", values.iter().sum::<f64>()),
            PivotAggregation::Count => format!("{}", values.len()),
            PivotAggregation::Average => format!("{}", values.iter().sum::<f64>() / values.len() as f64),
            PivotAggregation::Max => format!("{}", values.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b))),
            PivotAggregation::Min => format!("{}", values.iter().fold(f64::INFINITY, |a, &b| a.min(b))),
        }
    }

    fn extract_data(&self, range: &str, cells: &HashMap<String, String>) -> Vec<Vec<String>> {
        let parts: Vec<&str> = range.split(':').collect();
        if parts.len() != 2 {
            return Vec::new();
        }

        let (col1, row1) = self.parse_cell_ref(parts[0]);
        let (col2, row2) = self.parse_cell_ref(parts[1]);

        let mut data: Vec<Vec<String>> = Vec::new();
        for r in row1..=row2 {
            let mut row_data: Vec<String> = Vec::new();
            for c in col1..=col2 {
                let cell_ref = format!("{}{}", c as char, r);
                let value = cells.get(&cell_ref).cloned().unwrap_or_default();
                row_data.push(value);
            }
            data.push(row_data);
        }
        data
    }

    fn parse_cell_ref(&self, cell_ref: &str) -> (u8, usize) {
        let re = regex::Regex::new(r"([A-Za-z]+)(\d+)").unwrap();
        if let Some(caps) = re.captures(cell_ref) {
            let col = caps[1].chars().next().unwrap_or('A').to_ascii_uppercase() as u8;
            let row: usize = caps[2].parse().unwrap_or(1);
            (col, row)
        } else {
            (b'A', 1)
        }
    }

    pub fn get_available_fields(&self, range: &str, cells: &HashMap<String, String>) -> Vec<String> {
        let data = self.extract_data(range, cells);
        if data.is_empty() {
            return Vec::new();
        }
        data[0].clone()
    }
}
