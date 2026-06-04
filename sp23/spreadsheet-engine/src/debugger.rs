use serde::{Serialize, Deserialize};
use std::collections::{HashMap, HashSet};
use crate::excel::{FormulaDebugSession, FormulaDebugStep};
use crate::cell::Cell;

pub struct FormulaDebugger {
    sessions: HashMap<String, FormulaDebugSession>,
    breakpoints: HashMap<String, Vec<usize>>,
}

impl FormulaDebugger {
    pub fn new() -> Self {
        FormulaDebugger {
            sessions: HashMap::new(),
            breakpoints: HashMap::new(),
        }
    }

    pub fn start_debug_session(
        &mut self,
        cell_ref: &str,
        formula: &str,
        cells: &HashMap<String, Cell>,
    ) -> FormulaDebugSession {
        let steps = self.generate_debug_steps(formula, cells);
        let session = FormulaDebugSession {
            cell_ref: cell_ref.to_string(),
            original_formula: formula.to_string(),
            steps: steps.clone(),
            current_step: 0,
            is_complete: false,
            final_result: String::new(),
            breakpoints: self.breakpoints.get(cell_ref).cloned().unwrap_or_default(),
        };
        self.sessions.insert(cell_ref.to_string(), session.clone());
        session
    }

    pub fn step_forward(&mut self, cell_ref: &str) -> Option<FormulaDebugSession> {
        let session = self.sessions.get_mut(cell_ref)?;
        if session.current_step < session.steps.len() {
            session.current_step += 1;
            if session.current_step >= session.steps.len() {
                session.is_complete = true;
                session.final_result = session.steps.last()
                    .map(|s| s.result.clone())
                    .unwrap_or_default();
            }
        }
        self.sessions.get(cell_ref).cloned()
    }

    pub fn step_backward(&mut self, cell_ref: &str) -> Option<FormulaDebugSession> {
        let session = self.sessions.get_mut(cell_ref)?;
        if session.current_step > 0 {
            session.current_step -= 1;
            session.is_complete = false;
        }
        self.sessions.get(cell_ref).cloned()
    }

    pub fn run_to_breakpoint(&mut self, cell_ref: &str) -> Option<FormulaDebugSession> {
        let session = self.sessions.get_mut(cell_ref)?;
        let breakpoints = session.breakpoints.clone();
        
        while session.current_step < session.steps.len() {
            session.current_step += 1;
            if breakpoints.contains(&session.current_step) {
                break;
            }
        }
        
        if session.current_step >= session.steps.len() {
            session.is_complete = true;
            session.final_result = session.steps.last()
                .map(|s| s.result.clone())
                .unwrap_or_default();
        }
        
        self.sessions.get(cell_ref).cloned()
    }

    pub fn run_to_completion(&mut self, cell_ref: &str) -> Option<FormulaDebugSession> {
        let session = self.sessions.get_mut(cell_ref)?;
        session.current_step = session.steps.len();
        session.is_complete = true;
        session.final_result = session.steps.last()
            .map(|s| s.result.clone())
            .unwrap_or_default();
        self.sessions.get(cell_ref).cloned()
    }

    pub fn toggle_breakpoint(&mut self, cell_ref: &str, step_index: usize) {
        let breakpoints = self.breakpoints.entry(cell_ref.to_string()).or_default();
        if let Some(pos) = breakpoints.iter().position(|&x| x == step_index) {
            breakpoints.remove(pos);
        } else {
            breakpoints.push(step_index);
            breakpoints.sort();
        }
        
        if let Some(session) = self.sessions.get_mut(cell_ref) {
            session.breakpoints = breakpoints.clone();
        }
    }

    pub fn get_session(&self, cell_ref: &str) -> Option<&FormulaDebugSession> {
        self.sessions.get(cell_ref)
    }

    pub fn end_session(&mut self, cell_ref: &str) {
        self.sessions.remove(cell_ref);
    }

    fn generate_debug_steps(
        &self,
        formula: &str,
        cells: &HashMap<String, Cell>,
    ) -> Vec<FormulaDebugStep> {
        let mut steps = Vec::new();
        let mut index = 0;

        let re = regex::Regex::new(r"([A-Za-z]+\d+)|([A-Z]+\([^)]*\))").unwrap();
        
        let mut current = formula.to_string();
        
        for cap in re.captures_iter(formula) {
            let matched = cap.get(0).unwrap().as_str();
            
            if cap.get(1).is_some() {
                let cell_ref = matched.to_uppercase();
                let value = cells.get(&cell_ref)
                    .map(|c| c.get_display_value())
                    .unwrap_or_default();
                
                let step = FormulaDebugStep {
                    step_index: index,
                    expression: current.clone(),
                    sub_expression: matched.to_string(),
                    result: value.clone(),
                    dependencies: vec![cell_ref],
                    is_breakpoint: false,
                };
                steps.push(step);
                current = current.replace(matched, &value);
                index += 1;
            } else if cap.get(2).is_some() {
                let func_call = matched;
                let result = self.evaluate_function(func_call, cells);
                
                let deps = self.extract_dependencies(func_call);
                
                let step = FormulaDebugStep {
                    step_index: index,
                    expression: current.clone(),
                    sub_expression: func_call.to_string(),
                    result: result.clone(),
                    dependencies: deps,
                    is_breakpoint: false,
                };
                steps.push(step);
                current = current.replace(func_call, &result);
                index += 1;
            }
        }

        if index > 0 {
            let final_step = FormulaDebugStep {
                step_index: index,
                expression: current.clone(),
                sub_expression: String::new(),
                result: current.clone(),
                dependencies: Vec::new(),
                is_breakpoint: false,
            };
            steps.push(final_step);
        }

        steps
    }

    fn evaluate_function(&self, func_call: &str, cells: &HashMap<String, Cell>) -> String {
        let upper = func_call.to_uppercase();
        
        if upper.starts_with("SUM(") {
            let args = &upper[4..upper.len()-1];
            let refs = self.expand_range(args);
            let sum: f64 = refs.iter()
                .filter_map(|r| cells.get(r).and_then(|c| c.get_display_value().parse::<f64>().ok()))
                .sum();
            return format!("{}", sum);
        }
        
        if upper.starts_with("AVERAGE(") {
            let args = &upper[8..upper.len()-1];
            let refs = self.expand_range(args);
            let nums: Vec<f64> = refs.iter()
                .filter_map(|r| cells.get(r).and_then(|c| c.get_display_value().parse::<f64>().ok()))
                .collect();
            if nums.is_empty() { return "0".to_string(); }
            let avg: f64 = nums.iter().sum::<f64>() / nums.len() as f64;
            return format!("{}", avg);
        }

        func_call.to_string()
    }

    fn expand_range(&self, range: &str) -> Vec<String> {
        let parts: Vec<&str> = range.split(':').collect();
        if parts.len() != 2 {
            return vec![range.to_string().to_uppercase()];
        }

        let (col1, row1) = self.parse_cell_ref(parts[0]);
        let (col2, row2) = self.parse_cell_ref(parts[1]);

        let mut result = Vec::new();
        for c in col1..=col2 {
            for r in row1..=row2 {
                result.push(format!("{}{}", c as char, r));
            }
        }
        result
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

    fn extract_dependencies(&self, formula: &str) -> Vec<String> {
        let mut deps = HashSet::new();
        let re = regex::Regex::new(r"[A-Za-z]+\d+").unwrap();
        for cap in re.captures_iter(formula) {
            deps.insert(cap[0].to_string().to_uppercase());
        }
        deps.into_iter().collect()
    }
}
