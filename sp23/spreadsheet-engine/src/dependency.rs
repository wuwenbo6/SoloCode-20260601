use serde::{Serialize, Deserialize};
use std::collections::{HashMap, HashSet, VecDeque};

#[derive(Clone, Copy, PartialEq)]
enum Color {
    White,
    Gray,
    Black,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DependencyGraph {
    dependencies: HashMap<String, HashSet<String>>,
    dependents: HashMap<String, HashSet<String>>,
}

impl DependencyGraph {
    pub fn new() -> Self {
        DependencyGraph {
            dependencies: HashMap::new(),
            dependents: HashMap::new(),
        }
    }

    pub fn update_dependencies(&mut self, cell: &str, new_deps: &HashSet<String>) {
        if let Some(old_deps) = self.dependencies.get(cell).cloned() {
            for dep in old_deps {
                if let Some(deps) = self.dependents.get_mut(&dep) {
                    deps.remove(cell);
                }
            }
        }

        self.dependencies.insert(cell.to_string(), new_deps.clone());

        for dep in new_deps {
            self.dependents
                .entry(dep.clone())
                .or_insert_with(HashSet::new)
                .insert(cell.to_string());
        }
    }

    pub fn rollback_dependencies(&mut self, cell: &str, old_deps: &HashSet<String>) {
        self.update_dependencies(cell, old_deps);
    }

    pub fn get_dependencies(&self, cell: &str) -> HashSet<String> {
        self.dependencies.get(cell).cloned().unwrap_or_default()
    }

    pub fn has_cycle_from(&self, start_cell: &str) -> bool {
        let mut colors: HashMap<String, Color> = HashMap::new();
        self.dfs_detect_cycle(start_cell, &mut colors)
    }

    fn dfs_detect_cycle(&self, node: &str, colors: &mut HashMap<String, Color>) -> bool {
        let color = colors.entry(node.to_string()).or_insert(Color::White);

        match *color {
            Color::Gray => return true,
            Color::Black => return false,
            Color::White => {}
        }

        colors.insert(node.to_string(), Color::Gray);

        if let Some(deps) = self.dependencies.get(node) {
            for dep in deps {
                if self.dfs_detect_cycle(dep, colors) {
                    return true;
                }
            }
        }

        colors.insert(node.to_string(), Color::Black);
        false
    }

    pub fn has_cycle_iterative(&self, start_cell: &str) -> bool {
        let mut colors: HashMap<String, Color> = HashMap::new();

        enum FrameState {
            Enter,
            Exit,
        }

        let mut stack = vec![(start_cell.to_string(), FrameState::Enter)];

        while let Some((node, state)) = stack.pop() {
            match state {
                FrameState::Enter => {
                    let color = colors.entry(node.clone()).or_insert(Color::White);
                    match *color {
                        Color::Gray => return true,
                        Color::Black => continue,
                        Color::White => {}
                    }

                    colors.insert(node.clone(), Color::Gray);
                    stack.push((node.clone(), FrameState::Exit));

                    if let Some(deps) = self.dependencies.get(&node) {
                        for dep in deps {
                            stack.push((dep.clone(), FrameState::Enter));
                        }
                    }
                }
                FrameState::Exit => {
                    colors.insert(node, Color::Black);
                }
            }
        }

        false
    }

    pub fn get_dependents_recursive(&self, cell: &str) -> HashSet<String> {
        let mut result = HashSet::new();
        let mut queue = VecDeque::new();
        queue.push_back(cell.to_string());

        while let Some(current) = queue.pop_front() {
            if let Some(deps) = self.dependents.get(&current) {
                for dep in deps {
                    if !result.contains(dep) {
                        result.insert(dep.clone());
                        queue.push_back(dep.clone());
                    }
                }
            }
        }
        result
    }

    pub fn topological_sort(&self, cells: &HashSet<String>) -> Vec<String> {
        let mut in_degree: HashMap<String, usize> = HashMap::new();
        let mut result = Vec::new();
        let mut queue = VecDeque::new();

        for cell in cells {
            in_degree.insert(cell.clone(), 0);
        }

        for cell in cells {
            if let Some(deps) = self.dependencies.get(cell) {
                for dep in deps {
                    if cells.contains(dep) {
                        *in_degree.entry(cell.clone()).or_insert(0) += 1;
                    }
                }
            }
        }

        for (cell, &degree) in &in_degree {
            if degree == 0 {
                queue.push_back(cell.clone());
            }
        }

        while let Some(current) = queue.pop_front() {
            result.push(current.clone());

            if let Some(dependents) = self.dependents.get(&current) {
                for dep in dependents {
                    if cells.contains(dep) {
                        if let Some(degree) = in_degree.get_mut(dep) {
                            *degree -= 1;
                            if *degree == 0 {
                                queue.push_back(dep.clone());
                            }
                        }
                    }
                }
            }
        }

        result
    }
}
