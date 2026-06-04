use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::f64;

mod cell;
mod formula;
mod dependency;
mod excel;
mod pivot;
mod debugger;

use cell::Cell;
use formula::FormulaParser;
use dependency::DependencyGraph;
use excel::{PivotTableConfig, PivotTableResult, FormulaDebugSession};
use pivot::PivotTableEngine;
use debugger::FormulaDebugger;

#[wasm_bindgen]
#[derive(Serialize, Deserialize)]
pub struct SpreadsheetEngine {
    cells: HashMap<String, Cell>,
    dependency_graph: DependencyGraph,
    #[serde(skip)]
    custom_functions: HashMap<String, js_sys::Function>,
    #[serde(skip)]
    pivot_engine: PivotTableEngine,
    #[serde(skip)]
    debugger: FormulaDebugger,
}

#[wasm_bindgen]
impl SpreadsheetEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        SpreadsheetEngine {
            cells: HashMap::new(),
            dependency_graph: DependencyGraph::new(),
            custom_functions: HashMap::new(),
            pivot_engine: PivotTableEngine::new(),
            debugger: FormulaDebugger::new(),
        }
    }

    #[wasm_bindgen]
    pub fn set_cell(&mut self, cell_ref: &str, value: &str) -> Result<JsValue, JsValue> {
        let cell_ref = cell_ref.to_uppercase();
        let is_formula = value.starts_with('=');

        let cell = if is_formula {
            let formula = &value[1..];
            let parser = FormulaParser::new();
            let dependencies = parser.extract_dependencies(formula);

            let old_deps = self.dependency_graph.get_dependencies(&cell_ref);
            self.dependency_graph.update_dependencies(&cell_ref, &dependencies);

            if self.dependency_graph.has_cycle_from(&cell_ref) {
                self.dependency_graph.rollback_dependencies(&cell_ref, &old_deps);
                return Err(JsValue::from_str("Circular reference detected"));
            }

            Cell::new_formula(formula.to_string(), dependencies)
        } else {
            let old_deps = self.dependency_graph.get_dependencies(&cell_ref);
            if !old_deps.is_empty() {
                self.dependency_graph.update_dependencies(&cell_ref, &HashSet::new());
            }
            Cell::new_value(value.to_string())
        };

        self.cells.insert(cell_ref.clone(), cell);

        let affected = self.dependency_graph.get_dependents_recursive(&cell_ref);
        self.recalculate_cells(&affected);

        Ok(self.get_all_cells_json())
    }

    #[wasm_bindgen]
    pub fn get_cell_value(&self, cell_ref: &str) -> String {
        let cell_ref = cell_ref.to_uppercase();
        self.cells.get(&cell_ref)
            .map(|c| c.get_display_value())
            .unwrap_or_default()
    }

    #[wasm_bindgen]
    pub fn get_cell_formula(&self, cell_ref: &str) -> String {
        let cell_ref = cell_ref.to_uppercase();
        self.cells.get(&cell_ref)
            .and_then(|c| c.get_formula())
            .unwrap_or_default()
    }

    #[wasm_bindgen]
    pub fn register_custom_function(&mut self, name: &str, func: js_sys::Function) {
        self.custom_functions.insert(name.to_string(), func);
    }

    #[wasm_bindgen]
    pub fn to_json(&self) -> JsValue {
        self.get_all_cells_json()
    }

    #[wasm_bindgen]
    pub fn export_to_excel(&self) -> Result<JsValue, JsValue> {
        let cells_data: HashMap<String, String> = self.cells
            .iter()
            .map(|(k, v)| (k.clone(), v.get_display_value()))
            .collect();
        serde_wasm_bindgen::to_value(&cells_data)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen]
    pub fn import_from_excel(&mut self, data: JsValue) -> Result<JsValue, JsValue> {
        let cells_data: HashMap<String, String> = serde_wasm_bindgen::from_value(data)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        for (cell_ref, value) in &cells_data {
            let cell = if value.starts_with('=') {
                let formula = &value[1..];
                let parser = FormulaParser::new();
                let dependencies = parser.extract_dependencies(formula);
                self.dependency_graph.update_dependencies(cell_ref, &dependencies);
                Cell::new_formula(formula.to_string(), dependencies)
            } else {
                Cell::new_value(value.clone())
            };
            self.cells.insert(cell_ref.clone(), cell);
        }

        let all_cells = self.get_all_cells_hashmap();
        for cell_ref in cells_data.keys() {
            let affected = self.dependency_graph.get_dependents_recursive(cell_ref);
            self.recalculate_cells(&affected);
        }

        Ok(self.get_all_cells_json())
    }

    #[wasm_bindgen]
    pub fn generate_pivot_table(&self, config: JsValue) -> Result<JsValue, JsValue> {
        let config: PivotTableConfig = serde_wasm_bindgen::from_value(config)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let cells_map: HashMap<String, String> = self.cells
            .iter()
            .map(|(k, v)| (k.clone(), v.get_display_value()))
            .collect();

        let result = self.pivot_engine.generate_pivot_table(&config, &cells_map);
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen]
    pub fn get_pivot_fields(&self, range: &str) -> Result<JsValue, JsValue> {
        let cells_map: HashMap<String, String> = self.cells
            .iter()
            .map(|(k, v)| (k.clone(), v.get_display_value()))
            .collect();

        let fields = self.pivot_engine.get_available_fields(range, &cells_map);
        serde_wasm_bindgen::to_value(&fields)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen]
    pub fn start_debug_session(&mut self, cell_ref: &str) -> Result<JsValue, JsValue> {
        let cell_ref = cell_ref.to_uppercase();
        let cell = self.cells.get(&cell_ref)
            .ok_or_else(|| JsValue::from_str("Cell not found"))?;

        let formula = cell.get_formula()
            .ok_or_else(|| JsValue::from_str("Cell does not contain a formula"))?;

        let session = self.debugger.start_debug_session(&cell_ref, formula, &self.cells);
        serde_wasm_bindgen::to_value(&session)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen]
    pub fn debug_step_forward(&mut self, cell_ref: &str) -> Result<JsValue, JsValue> {
        let cell_ref = cell_ref.to_uppercase();
        let session = self.debugger.step_forward(&cell_ref)
            .ok_or_else(|| JsValue::from_str("No active debug session"))?;
        serde_wasm_bindgen::to_value(&session)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen]
    pub fn debug_step_backward(&mut self, cell_ref: &str) -> Result<JsValue, JsValue> {
        let cell_ref = cell_ref.to_uppercase();
        let session = self.debugger.step_backward(&cell_ref)
            .ok_or_else(|| JsValue::from_str("No active debug session"))?;
        serde_wasm_bindgen::to_value(&session)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen]
    pub fn debug_run_to_breakpoint(&mut self, cell_ref: &str) -> Result<JsValue, JsValue> {
        let cell_ref = cell_ref.to_uppercase();
        let session = self.debugger.run_to_breakpoint(&cell_ref)
            .ok_or_else(|| JsValue::from_str("No active debug session"))?;
        serde_wasm_bindgen::to_value(&session)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen]
    pub fn debug_run_to_completion(&mut self, cell_ref: &str) -> Result<JsValue, JsValue> {
        let cell_ref = cell_ref.to_uppercase();
        let session = self.debugger.run_to_completion(&cell_ref)
            .ok_or_else(|| JsValue::from_str("No active debug session"))?;
        serde_wasm_bindgen::to_value(&session)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen]
    pub fn debug_toggle_breakpoint(&mut self, cell_ref: &str, step_index: usize) {
        let cell_ref = cell_ref.to_uppercase();
        self.debugger.toggle_breakpoint(&cell_ref, step_index);
    }

    #[wasm_bindgen]
    pub fn debug_end_session(&mut self, cell_ref: &str) {
        let cell_ref = cell_ref.to_uppercase();
        self.debugger.end_session(&cell_ref);
    }
}

impl SpreadsheetEngine {
    fn get_all_cells_json(&self) -> JsValue {
        let result: HashMap<String, String> = self.cells
            .iter()
            .map(|(k, v)| (k.clone(), v.get_display_value()))
            .collect();
        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }

    fn get_all_cells_hashmap(&self) -> HashMap<String, String> {
        self.cells
            .iter()
            .map(|(k, v)| (k.clone(), v.get_display_value()))
            .collect()
    }

    fn recalculate_cells(&mut self, cells: &HashSet<String>) {
        let order = self.dependency_graph.topological_sort(cells);
        let mut parser = FormulaParser::new();
        parser.set_custom_functions(self.custom_functions.clone());

        for cell_ref in order {
            if let Some(cell) = self.cells.get(&cell_ref).cloned() {
                if let Some(formula) = cell.get_formula() {
                    let value = parser.evaluate(formula, &self.cells);
                    if let Some(mut cell) = self.cells.get_mut(&cell_ref) {
                        cell.set_calculated_value(value);
                    }
                }
            }
        }
    }
}
