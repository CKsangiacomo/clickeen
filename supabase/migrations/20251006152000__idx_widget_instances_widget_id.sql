-- Add FK index for widget_instances.widget_id to optimize joins to widgets
CREATE INDEX IF NOT EXISTS idx_widget_instances_widget_id 
  ON widget_instances(widget_id);

