use std::collections::{HashMap, HashSet};
use wasm_bindgen::JsValue;
use js_sys::{Array, Function};

const MAX_CUSTOM_FUNC_DEPTH: u32 = 64;

#[derive(Clone)]
pub struct FormulaParser {
    custom_functions: HashMap<String, Function>,
    call_depth: u32,
    call_stack: HashSet<String>,
}

struct VLookupIndex {
    hash_map: HashMap<String, Vec<usize>>,
    sorted_keys: Vec<String>,
    dirty: bool,
    range_key: String,
}

impl VLookupIndex {
    fn new() -> Self {
        VLookupIndex {
            hash_map: HashMap::new(),
            sorted_keys: Vec::new(),
            dirty: true,
            range_key: String::new(),
        }
    }

    fn build(&mut self, lookup_col: char, min_row: usize, max_row: usize, cells: &HashMap<String, super::cell::Cell>) {
        self.hash_map.clear();
        self.sorted_keys.clear();
        self.range_key = format!("{}{}:{}", lookup_col, min_row, max_row);

        for row in min_row..=max_row {
            let cell_ref = format!("{}{}", lookup_col, row);
            if let Some(cell) = cells.get(&cell_ref) {
                let value = cell.get_display_value();
                if !value.is_empty() {
                    self.hash_map.entry(value.clone()).or_default().push(row);
                    let pos = self.sorted_keys.binary_search(&value);
                    if let Err(idx) = pos {
                        self.sorted_keys.insert(idx, value);
                    }
                }
            }
        }

        self.dirty = false;
    }

    fn exact_lookup(&self, value: &str) -> Option<usize> {
        self.hash_map.get(value).and_then(|rows| rows.first().copied())
    }

    fn binary_search_lookup(&self, value: &str) -> Option<usize> {
        if self.sorted_keys.is_empty() {
            return None;
        }

        let pos = self.sorted_keys.binary_search(value);

        match pos {
            Ok(idx) => {
                let key = &self.sorted_keys[idx];
                self.hash_map.get(key).and_then(|rows| rows.first().copied())
            }
            Err(idx) => {
                if idx == 0 {
                    return None;
                }
                let key = &self.sorted_keys[idx - 1];
                self.hash_map.get(key).and_then(|rows| rows.first().copied())
            }
        }
    }

    fn needs_rebuild(&self, range_key: &str) -> bool {
        self.dirty || self.range_key != range_key
    }
}

impl FormulaParser {
    pub fn new() -> Self {
        FormulaParser {
            custom_functions: HashMap::new(),
            call_depth: 0,
            call_stack: HashSet::new(),
        }
    }

    pub fn set_custom_functions(&mut self, funcs: HashMap<String, Function>) {
        self.custom_functions = funcs;
    }

    pub fn extract_dependencies(&self, formula: &str) -> HashSet<String> {
        let mut deps = HashSet::new();
        let re = regex::Regex::new(r"[A-Za-z]+\d+").unwrap();

        for cap in re.captures_iter(formula) {
            deps.insert(cap[0].to_string().to_uppercase());
        }
        deps
    }

    pub fn evaluate(&mut self, formula: &str, cells: &HashMap<String, super::cell::Cell>) -> String {
        let formula = formula.to_uppercase();

        if formula.starts_with("SUM(") {
            self.eval_sum(&formula[4..formula.len()-1], cells)
        } else if formula.starts_with("AVERAGE(") {
            self.eval_average(&formula[8..formula.len()-1], cells)
        } else if formula.starts_with("IF(") {
            self.eval_if(&formula[3..formula.len()-1], cells)
        } else if formula.starts_with("VLOOKUP(") {
            self.eval_vlookup(&formula[8..formula.len()-1], cells)
        } else {
            self.eval_custom_function(&formula, cells)
        }
    }

    fn eval_sum(&self, args: &str, cells: &HashMap<String, super::cell::Cell>) -> String {
        let values = self.parse_range(args, cells);
        let sum: f64 = values.iter().filter_map(|v| v.parse::<f64>().ok()).sum();
        format!("{}", sum)
    }

    fn eval_average(&self, args: &str, cells: &HashMap<String, super::cell::Cell>) -> String {
        let values = self.parse_range(args, cells);
        let nums: Vec<f64> = values.iter().filter_map(|v| v.parse::<f64>().ok()).collect();
        if nums.is_empty() {
            return "0".to_string();
        }
        let avg: f64 = nums.iter().sum::<f64>() / nums.len() as f64;
        format!("{}", avg)
    }

    fn eval_if(&self, args: &str, cells: &HashMap<String, super::cell::Cell>) -> String {
        let parts = self.split_function_args(args);
        if parts.len() != 3 {
            return "#ERROR".to_string();
        }

        let condition = self.eval_expression(&parts[0], cells);
        let cond_num: f64 = condition.parse().unwrap_or(0.0);

        if cond_num != 0.0 {
            self.eval_expression(&parts[1], cells)
        } else {
            self.eval_expression(&parts[2], cells)
        }
    }

    fn eval_vlookup(&self, args: &str, cells: &HashMap<String, super::cell::Cell>) -> String {
        let parts = self.split_function_args(args);
        if parts.len() != 4 {
            return "#ERROR".to_string();
        }

        let lookup_value = self.eval_expression(&parts[0], cells);
        let table_range = &parts[1];
        let col_index: usize = parts[2].parse().unwrap_or(1);
        let range_lookup: bool = parts[3].trim().to_uppercase() != "FALSE";

        let cell_refs = self.expand_range(table_range);
        if cell_refs.is_empty() {
            return "#N/A".to_string();
        }

        let (min_row, max_row) = cell_refs.iter()
            .map(|r| self.parse_cell_ref(r).1)
            .fold((usize::MAX, 0), |(min, max), r| (min.min(r), max.max(r)));

        let (lookup_col, _) = self.parse_cell_ref(&cell_refs[0]);
        let return_col = (lookup_col as u8 + (col_index - 1) as u8) as char;

        if range_lookup {
            self.vlookup_binary_search(&lookup_value, lookup_col, min_row, max_row, return_col, cells)
        } else {
            self.vlookup_hash_exact(&lookup_value, lookup_col, min_row, max_row, return_col, cells)
        }
    }

    fn vlookup_hash_exact(&self, lookup_value: &str, lookup_col: char, min_row: usize, max_row: usize, return_col: char, cells: &HashMap<String, super::cell::Cell>) -> String {
        for row in min_row..=max_row {
            let lookup_cell = format!("{}{}", lookup_col, row);
            let cell_value = cells.get(&lookup_cell)
                .map(|c| c.get_display_value())
                .unwrap_or_default();

            if cell_value == lookup_value {
                let return_cell = format!("{}{}", return_col, row);
                return cells.get(&return_cell)
                    .map(|c| c.get_display_value())
                    .unwrap_or_else(|| "#N/A".to_string());
            }
        }
        "#N/A".to_string()
    }

    fn vlookup_binary_search(&self, lookup_value: &str, lookup_col: char, min_row: usize, max_row: usize, return_col: char, cells: &HashMap<String, super::cell::Cell>) -> String {
        let mut low = min_row;
        let mut high = max_row;
        let mut best_row: Option<usize> = None;

        while low <= high {
            let mid = low + (high - low) / 2;
            let mid_cell = format!("{}{}", lookup_col, mid);
            let mid_value = cells.get(&mid_cell)
                .map(|c| c.get_display_value())
                .unwrap_or_default();

            if mid_value == lookup_value {
                let return_cell = format!("{}{}", return_col, mid);
                return cells.get(&return_cell)
                    .map(|c| c.get_display_value())
                    .unwrap_or_else(|| "#N/A".to_string());
            }

            let mid_num: f64 = mid_value.parse().unwrap_or(f64::NAN);
            let lookup_num: f64 = lookup_value.parse().unwrap_or(f64::NAN);

            if !mid_num.is_nan() && !lookup_num.is_nan() {
                if mid_num < lookup_num {
                    best_row = Some(mid);
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            } else {
                if mid_value.as_bytes() < lookup_value.as_bytes() {
                    best_row = Some(mid);
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }
        }

        if let Some(row) = best_row {
            let return_cell = format!("{}{}", return_col, row);
            return cells.get(&return_cell)
                .map(|c| c.get_display_value())
                .unwrap_or_else(|| "#N/A".to_string());
        }

        "#N/A".to_string()
    }

    fn eval_custom_function(&mut self, formula: &str, cells: &HashMap<String, super::cell::Cell>) -> String {
        if let Some(paren_idx) = formula.find('(') {
            let func_name = &formula[..paren_idx];

            if self.custom_functions.contains_key(func_name) {
                if self.call_depth >= MAX_CUSTOM_FUNC_DEPTH {
                    return "#RECURSION_LIMIT".to_string();
                }

                if self.call_stack.contains(func_name) {
                    return "#CIRCULAR_CALL".to_string();
                }

                let args_str = &formula[paren_idx+1..formula.len()-1];
                let func = self.custom_functions.get(func_name).cloned();

                if let Some(func) = func {
                    let arg_parts = self.split_function_args(args_str);
                    let js_args = Array::new();

                    for arg in arg_parts {
                        let val = self.eval_expression(&arg, cells);
                        if let Ok(num) = val.parse::<f64>() {
                            js_args.push(&JsValue::from_f64(num));
                        } else {
                            js_args.push(&JsValue::from_str(&val));
                        }
                    }

                    self.call_depth += 1;
                    self.call_stack.insert(func_name.to_string());

                    let result = func.apply(&JsValue::NULL, &js_args);

                    self.call_depth -= 1;
                    self.call_stack.remove(func_name);

                    match result {
                        Ok(result) => {
                            if let Some(num) = result.as_f64() {
                                format!("{}", num)
                            } else if let Some(s) = result.as_string() {
                                s
                            } else {
                                "#ERROR".to_string()
                            }
                        }
                        Err(_) => "#ERROR".to_string(),
                    }
                } else {
                    self.eval_expression(formula, cells)
                }
            } else {
                self.eval_expression(formula, cells)
            }
        } else {
            self.eval_expression(formula, cells)
        }
    }

    fn eval_expression(&self, expr: &str, cells: &HashMap<String, super::cell::Cell>) -> String {
        let expr = expr.trim();

        if let Ok(num) = expr.parse::<f64>() {
            return format!("{}", num);
        }

        if regex::Regex::new(r"^[A-Za-z]+\d+$").unwrap().is_match(expr) {
            return cells.get(&expr.to_string().to_uppercase())
                .map(|c| c.get_display_value())
                .unwrap_or_default();
        }

        expr.to_string()
    }

    fn parse_range(&self, range: &str, cells: &HashMap<String, super::cell::Cell>) -> Vec<String> {
        let cell_refs = self.expand_range(range);
        cell_refs.iter()
            .map(|r| cells.get(r).map(|c| c.get_display_value()).unwrap_or_default())
            .collect()
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
                result.push(format!("{}{}", c, r));
            }
        }
        result
    }

    fn parse_cell_ref(&self, cell_ref: &str) -> (char, usize) {
        let re = regex::Regex::new(r"([A-Za-z]+)(\d+)").unwrap();
        if let Some(caps) = re.captures(cell_ref) {
            let col = caps[1].chars().next().unwrap_or('A').to_ascii_uppercase();
            let row: usize = caps[2].parse().unwrap_or(1);
            (col, row)
        } else {
            ('A', 1)
        }
    }

    fn split_function_args(&self, args: &str) -> Vec<String> {
        let mut result = Vec::new();
        let mut current = String::new();
        let mut depth = 0;

        for c in args.chars() {
            match c {
                '(' => {
                    depth += 1;
                    current.push(c);
                }
                ')' => {
                    depth -= 1;
                    current.push(c);
                }
                ',' if depth == 0 => {
                    result.push(current.trim().to_string());
                    current.clear();
                }
                _ => current.push(c),
            }
        }

        if !current.is_empty() {
            result.push(current.trim().to_string());
        }

        result
    }
}
