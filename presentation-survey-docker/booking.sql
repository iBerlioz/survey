WITH latest AS (SELECT COALESCE(MAX(topic_round),0) AS r FROM responses WHERE reserved_topic IS NOT NULL), current AS (SELECT r + CASE WHEN (SELECT COUNT(DISTINCT topic) FROM responses WHERE reserved_topic IS NOT NULL AND topic_round=r)>=? THEN 1 ELSE 0 END AS r FROM latest)
INSERT INTO responses(id,name,format,topic,created_at,reserved_topic,topic_round)
SELECT ?,?,?,?,?,CASE WHEN ? THEN CAST(r AS TEXT)||':'||? ELSE NULL END,r FROM current
WHERE (?=0 OR (SELECT COUNT(*) FROM responses WHERE format=?)<8)
AND (?=0 OR (r=? AND NOT EXISTS(SELECT 1 FROM responses WHERE reserved_topic IS NOT NULL AND topic_round=r AND topic=?)))