use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum GraphError {
    #[error("Invalid graph format: {0}")]
    InvalidFormat(String),

    #[error("Cycle detected in workflow graph")]
    CycleDetected,

    #[error("Node not found: {0}")]
    NodeNotFound(String),

    #[error("JSON parsing error: {0}")]
    JsonError(#[from] serde_json::Error),
}

/// Parsed node from React Flow graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedNode {
    pub id: String,
    pub label: String,
    pub agent_role: String,
    pub system_prompt: Option<String>,
    pub assigned_task: Option<String>,
}

/// Parsed edge from React Flow graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub data_type: Option<String>,
}

/// Internal React Flow node structure for deserialization
#[derive(Debug, Deserialize)]
struct ReactFlowNode {
    id: String,
    data: ReactFlowNodeData,
}

#[derive(Debug, Deserialize)]
struct ReactFlowNodeData {
    label: String,
    #[serde(rename = "agentRole")]
    agent_role: String,
    #[serde(rename = "systemPrompt")]
    system_prompt: Option<String>,
    #[serde(rename = "assignedTask")]
    assigned_task: Option<String>,
}

/// Internal React Flow edge structure for deserialization
#[derive(Debug, Deserialize)]
struct ReactFlowEdge {
    id: String,
    source: String,
    target: String,
    data: Option<ReactFlowEdgeData>,
}

#[derive(Debug, Deserialize)]
struct ReactFlowEdgeData {
    #[serde(rename = "dataType")]
    data_type: Option<String>,
}

/// Workflow graph with adjacency lists for traversal
#[derive(Debug, Clone)]
pub struct WorkflowGraph {
    pub nodes: HashMap<String, ParsedNode>,
    pub edges: Vec<ParsedEdge>,
    /// Adjacency list: node_id -> list of successor node_ids
    pub successors: HashMap<String, Vec<String>>,
    /// Reverse adjacency: node_id -> list of predecessor node_ids
    pub predecessors: HashMap<String, Vec<String>>,
}

impl WorkflowGraph {
    /// Parse a React Flow graph JSON into a WorkflowGraph
    pub fn from_json(graph_json: &serde_json::Value) -> Result<Self, GraphError> {
        // Extract nodes array
        let nodes_json = graph_json
            .get("nodes")
            .ok_or_else(|| GraphError::InvalidFormat("Missing 'nodes' field".to_string()))?;

        let rf_nodes: Vec<ReactFlowNode> = serde_json::from_value(nodes_json.clone())?;

        // Extract edges array
        let edges_json = graph_json
            .get("edges")
            .ok_or_else(|| GraphError::InvalidFormat("Missing 'edges' field".to_string()))?;

        let rf_edges: Vec<ReactFlowEdge> = serde_json::from_value(edges_json.clone())?;

        // Convert to parsed nodes
        let mut nodes = HashMap::new();
        for rf_node in rf_nodes {
            let parsed = ParsedNode {
                id: rf_node.id.clone(),
                label: rf_node.data.label,
                agent_role: rf_node.data.agent_role,
                system_prompt: rf_node.data.system_prompt,
                assigned_task: rf_node.data.assigned_task,
            };
            nodes.insert(rf_node.id, parsed);
        }

        // Convert to parsed edges and build adjacency lists
        let mut edges = Vec::new();
        let mut successors: HashMap<String, Vec<String>> = HashMap::new();
        let mut predecessors: HashMap<String, Vec<String>> = HashMap::new();

        // Initialize empty adjacency lists for all nodes
        for node_id in nodes.keys() {
            successors.insert(node_id.clone(), Vec::new());
            predecessors.insert(node_id.clone(), Vec::new());
        }

        for rf_edge in rf_edges {
            // Validate source and target exist
            if !nodes.contains_key(&rf_edge.source) {
                return Err(GraphError::NodeNotFound(rf_edge.source));
            }
            if !nodes.contains_key(&rf_edge.target) {
                return Err(GraphError::NodeNotFound(rf_edge.target));
            }

            let parsed = ParsedEdge {
                id: rf_edge.id,
                source: rf_edge.source.clone(),
                target: rf_edge.target.clone(),
                data_type: rf_edge.data.and_then(|d| d.data_type),
            };

            // Build adjacency lists
            successors
                .entry(rf_edge.source.clone())
                .or_default()
                .push(rf_edge.target.clone());
            predecessors
                .entry(rf_edge.target)
                .or_default()
                .push(rf_edge.source);

            edges.push(parsed);
        }

        Ok(Self {
            nodes,
            edges,
            successors,
            predecessors,
        })
    }

    /// Compute execution levels using Kahn's algorithm (topological sort)
    /// Returns Vec<Vec<String>> where each inner vec contains nodes that can run in parallel
    pub fn compute_execution_levels(&self) -> Result<Vec<Vec<String>>, GraphError> {
        // Calculate in-degree for each node
        let mut in_degree: HashMap<String, usize> = HashMap::new();
        for node_id in self.nodes.keys() {
            in_degree.insert(
                node_id.clone(),
                self.predecessors.get(node_id).map_or(0, |p| p.len()),
            );
        }

        // Initialize queue with nodes that have no dependencies (in-degree 0)
        let mut queue: VecDeque<String> = in_degree
            .iter()
            .filter(|(_, &deg)| deg == 0)
            .map(|(id, _)| id.clone())
            .collect();

        let mut levels: Vec<Vec<String>> = Vec::new();
        let mut processed_count = 0;

        while !queue.is_empty() {
            // All nodes in the current queue can execute in parallel (same level)
            let current_level: Vec<String> = queue.drain(..).collect();
            processed_count += current_level.len();

            // Find next level's nodes
            let mut next_queue: Vec<String> = Vec::new();

            for node_id in &current_level {
                if let Some(successors) = self.successors.get(node_id) {
                    for succ_id in successors {
                        if let Some(deg) = in_degree.get_mut(succ_id) {
                            *deg -= 1;
                            if *deg == 0 {
                                next_queue.push(succ_id.clone());
                            }
                        }
                    }
                }
            }

            levels.push(current_level);

            // Add next level nodes to queue
            for node_id in next_queue {
                queue.push_back(node_id);
            }
        }

        // Check for cycles: if we haven't processed all nodes, there's a cycle
        if processed_count != self.nodes.len() {
            return Err(GraphError::CycleDetected);
        }

        Ok(levels)
    }

    /// Get all node IDs that must complete before the given node can start
    pub fn get_dependencies(&self, node_id: &str) -> Vec<String> {
        self.predecessors
            .get(node_id)
            .cloned()
            .unwrap_or_default()
    }

    /// Get a node by ID
    pub fn get_node(&self, node_id: &str) -> Option<&ParsedNode> {
        self.nodes.get(node_id)
    }

    /// Get total number of nodes
    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    /// Check if the graph is empty
    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    /// Get all root nodes (nodes with no predecessors)
    pub fn get_root_nodes(&self) -> Vec<String> {
        self.nodes
            .keys()
            .filter(|id| {
                self.predecessors
                    .get(*id)
                    .map_or(true, |preds| preds.is_empty())
            })
            .cloned()
            .collect()
    }

    /// Get all leaf nodes (nodes with no successors)
    pub fn get_leaf_nodes(&self) -> Vec<String> {
        self.nodes
            .keys()
            .filter(|id| {
                self.successors
                    .get(*id)
                    .map_or(true, |succs| succs.is_empty())
            })
            .cloned()
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn create_test_graph() -> serde_json::Value {
        json!({
            "nodes": [
                {"id": "a", "data": {"label": "Node A", "agentRole": "orchestrator"}},
                {"id": "b", "data": {"label": "Node B", "agentRole": "implementer"}},
                {"id": "c", "data": {"label": "Node C", "agentRole": "tester"}},
                {"id": "d", "data": {"label": "Node D", "agentRole": "documenter"}}
            ],
            "edges": [
                {"id": "e1", "source": "a", "target": "b"},
                {"id": "e2", "source": "a", "target": "c"},
                {"id": "e3", "source": "b", "target": "d"},
                {"id": "e4", "source": "c", "target": "d"}
            ]
        })
    }

    #[test]
    fn test_parse_graph() {
        let json = create_test_graph();
        let graph = WorkflowGraph::from_json(&json).unwrap();

        assert_eq!(graph.node_count(), 4);
        assert_eq!(graph.edges.len(), 4);
    }

    #[test]
    fn test_topological_sort() {
        let json = create_test_graph();
        let graph = WorkflowGraph::from_json(&json).unwrap();
        let levels = graph.compute_execution_levels().unwrap();

        // Level 0: [a] (root)
        // Level 1: [b, c] (can run in parallel)
        // Level 2: [d] (depends on both b and c)
        assert_eq!(levels.len(), 3);
        assert_eq!(levels[0], vec!["a"]);
        assert!(levels[1].contains(&"b".to_string()));
        assert!(levels[1].contains(&"c".to_string()));
        assert_eq!(levels[2], vec!["d"]);
    }

    #[test]
    fn test_cycle_detection() {
        let json = json!({
            "nodes": [
                {"id": "a", "data": {"label": "A", "agentRole": "implementer"}},
                {"id": "b", "data": {"label": "B", "agentRole": "implementer"}},
                {"id": "c", "data": {"label": "C", "agentRole": "implementer"}}
            ],
            "edges": [
                {"id": "e1", "source": "a", "target": "b"},
                {"id": "e2", "source": "b", "target": "c"},
                {"id": "e3", "source": "c", "target": "a"}
            ]
        });

        let graph = WorkflowGraph::from_json(&json).unwrap();
        let result = graph.compute_execution_levels();

        assert!(matches!(result, Err(GraphError::CycleDetected)));
    }

    #[test]
    fn test_root_and_leaf_nodes() {
        let json = create_test_graph();
        let graph = WorkflowGraph::from_json(&json).unwrap();

        let roots = graph.get_root_nodes();
        assert_eq!(roots, vec!["a"]);

        let leaves = graph.get_leaf_nodes();
        assert_eq!(leaves, vec!["d"]);
    }
}
