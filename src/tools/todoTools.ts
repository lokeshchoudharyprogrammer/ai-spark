import { supabase } from "../db/supabase.js";
import { dispatchEvent } from "../services/webhookService.js";

// Tool Definitions
export const todoToolsDefinition = [
  {
    name: "create_todo",
    description: "Create a new To-Do task",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        due_date: { type: "string", format: "date-time" }
      },
      required: ["title"]
    }
  },
  {
    name: "list_todos",
    description: "List and filter To-Do tasks",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        search: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "get_todo",
    description: "Get a specific To-Do task by ID",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" }
      },
      required: ["id"]
    }
  },
  {
    name: "update_todo",
    description: "Update a To-Do task",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        due_date: { type: "string", format: "date-time" }
      },
      required: ["id"]
    }
  },
  {
    name: "delete_todo",
    description: "Delete a To-Do task",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" }
      },
      required: ["id"]
    }
  }
];

// Tool Handlers
export async function handleCreateTodo(args: any) {
  const { title, description, priority = 'medium', due_date } = args;
  
  const { data, error } = await supabase
    .from('todos')
    .insert([{ title, description, priority, due_date }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create todo: ${error.message}`);
  }

  await dispatchEvent('todo.created', data);
  
  return {
    content: [{ type: "text", text: `Todo created successfully:\n${JSON.stringify(data, null, 2)}` }]
  };
}

export async function handleListTodos(args: any) {
  const { status, priority, search, limit = 20 } = args;
  const actualLimit = Math.min(limit, 100);

  let query = supabase.from('todos').select('*');

  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

  query = query.order('created_at', { ascending: false }).limit(actualLimit);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list todos: ${error.message}`);
  }

  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
  };
}

export async function handleGetTodo(args: any) {
  const { id } = args;

  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return {
      content: [{ type: "text", text: `Todo with ID ${id} not found.` }],
      isError: true
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
  };
}

export async function handleUpdateTodo(args: any) {
  const { id, title, description, status, priority, due_date } = args;

  const { data: previousData, error: fetchError } = await supabase
    .from('todos')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !previousData) {
    throw new Error(`Todo with ID ${id} not found.`);
  }

  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  if (priority !== undefined) updates.priority = priority;
  if (due_date !== undefined) updates.due_date = due_date;

  const { data, error } = await supabase
    .from('todos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update todo: ${error.message}`);
  }

  await dispatchEvent('todo.updated', data, { previous_state: previousData });

  return {
    content: [{ type: "text", text: `Todo updated successfully:\n${JSON.stringify(data, null, 2)}` }]
  };
}

export async function handleDeleteTodo(args: any) {
  const { id } = args;

  const { data: previousData, error: fetchError } = await supabase
    .from('todos')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !previousData) {
    throw new Error(`Todo with ID ${id} not found.`);
  }

  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete todo: ${error.message}`);
  }

  await dispatchEvent('todo.deleted', previousData);

  return {
    content: [{ type: "text", text: `Todo with ID ${id} deleted successfully.` }]
  };
}
