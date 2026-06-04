use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone)]
pub struct ExcelCellData {
    pub cell_ref: String,
    pub value: String,
    pub formula: Option<String>,
    pub style: Option<CellStyle>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CellStyle {
    pub bold: bool,
    pub italic: bool,
    pub font_size: f64,
    pub font_color: String,
    pub bg_color: String,
}

#[derive(Serialize, Deserialize)]
pub struct ExcelWorkbookData {
    pub sheets: Vec<ExcelSheetData>,
}

#[derive(Serialize, Deserialize)]
pub struct ExcelSheetData {
    pub name: String,
    pub cells: Vec<ExcelCellData>,
    pub column_widths: HashMap<String, f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PivotTableConfig {
    pub data_range: String,
    pub rows: Vec<String>,
    pub columns: Vec<String>,
    pub values: Vec<PivotValue>,
    pub filters: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PivotValue {
    pub field: String,
    pub function: PivotAggregation,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum PivotAggregation {
    Sum,
    Count,
    Average,
    Max,
    Min,
}

#[derive(Serialize, Deserialize)]
pub struct PivotTableResult {
    pub row_headers: Vec<String>,
    pub column_headers: Vec<String>,
    pub values: Vec<Vec<String>>,
    pub grand_total_row: Vec<String>,
    pub grand_total_column: Vec<String>,
    pub grand_total: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct FormulaDebugStep {
    pub step_index: usize,
    pub expression: String,
    pub result: String,
    pub sub_expression: String,
    pub dependencies: Vec<String>,
    pub is_breakpoint: bool,
}

#[derive(Serialize, Deserialize)]
pub struct FormulaDebugSession {
    pub cell_ref: String,
    pub original_formula: String,
    pub steps: Vec<FormulaDebugStep>,
    pub current_step: usize,
    pub is_complete: bool,
    pub final_result: String,
    pub breakpoints: Vec<usize>,
}

impl Default for CellStyle {
    fn default() -> Self {
        CellStyle {
            bold: false,
            italic: false,
            font_size: 12.0,
            font_color: "#000000".to_string(),
            bg_color: "#FFFFFF".to_string(),
        }
    }
}

pub fn parse_cell_value(value: &str) -> f64 {
    value.parse::<f64>().unwrap_or(0.0)
}

pub fn is_numeric(value: &str) -> bool {
    value.parse::<f64>().is_ok()
}
