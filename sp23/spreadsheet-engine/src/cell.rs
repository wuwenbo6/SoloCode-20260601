use serde::{Serialize, Deserialize};
use std::collections::HashSet;

#[derive(Clone, Serialize, Deserialize)]
pub struct Cell {
    cell_type: CellType,
    calculated_value: String,
}

#[derive(Clone, Serialize, Deserialize)]
enum CellType {
    Value(String),
    Formula {
        formula: String,
        dependencies: HashSet<String>,
    },
}

impl Cell {
    pub fn new_value(value: String) -> Self {
        Cell {
            calculated_value: value.clone(),
            cell_type: CellType::Value(value),
        }
    }

    pub fn new_formula(formula: String, dependencies: HashSet<String>) -> Self {
        Cell {
            calculated_value: String::new(),
            cell_type: CellType::Formula { formula, dependencies },
        }
    }

    pub fn get_display_value(&self) -> String {
        self.calculated_value.clone()
    }

    pub fn get_formula(&self) -> Option<&str> {
        match &self.cell_type {
            CellType::Formula { formula, .. } => Some(formula),
            _ => None,
        }
    }

    pub fn set_calculated_value(&mut self, value: String) {
        self.calculated_value = value;
    }

    pub fn get_dependencies(&self) -> Option<&HashSet<String>> {
        match &self.cell_type {
            CellType::Formula { dependencies, .. } => Some(dependencies),
            _ => None,
        }
    }
}
