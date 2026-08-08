from typing import Optional


class MCPClient:
    async def list_assets(self) -> list[dict]:
        return [
            {
                "urn": "urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)",
                "name": "daily_revenue_report",
                "platform": "hive",
                "env": "PROD",
                "type": "DATASET",
                "description": "Daily expected cadence, but lastModified is ~30 days old",
                "owners": ["urn:li:corpuser:datahub"],
                "issue": "stale_freshness",
            },
            {
                "urn": "urn:li:dataset:(urn:li:dataPlatform:hive,orders_revenue_summary,PROD)",
                "name": "orders_revenue_summary",
                "platform": "hive",
                "env": "PROD",
                "type": "DATASET",
                "description": "Upstream lineage points at orders_source_legacy, which was never ingested",
                "issue": "broken_lineage",
            },
            {
                "urn": "urn:li:dataset:(urn:li:dataPlatform:hive,user_churn_predictions,PROD)",
                "name": "user_churn_predictions",
                "platform": "hive",
                "env": "PROD",
                "type": "DATASET",
                "description": "Ownership aspect is explicitly empty",
                "owners": [],
                "issue": "no_owner",
            },
        ]

    async def get_upstream(self, urn: str) -> list[dict]:
        if "orders_revenue_summary" in urn:
            return [
                {
                    "urn": "urn:li:dataset:(urn:li:dataPlatform:hive,orders_source_legacy,PROD)",
                    "name": "orders_source_legacy",
                    "depth": 1,
                    "exists": False,
                    "owners": [],
                }
            ]
        if "user_churn_predictions" in urn:
            return [
                {
                    "urn": "urn:li:dataset:(urn:li:dataPlatform:hive,user_events_raw,PROD)",
                    "name": "user_events_raw",
                    "depth": 1,
                    "exists": True,
                    "owners": ["urn:li:corpuser:analytics"],
                }
            ]
        return []

    async def get_downstream(self, urn: str) -> list[dict]:
        if "daily_revenue_report" in urn:
            return [
                {
                    "urn": "urn:li:chart:(looker,revenue_dashboard,PROD)",
                    "name": "Revenue Dashboard",
                    "depth": 1,
                    "exists": True,
                    "owners": ["urn:li:corpuser:bi_team"],
                },
                {
                    "urn": "urn:li:dataset:(urn:li:dataPlatform:hive,exec_summary_daily,PROD)",
                    "name": "exec_summary_daily",
                    "depth": 2,
                    "exists": True,
                    "owners": [],
                },
            ]
        if "orders_revenue_summary" in urn:
            return [
                {
                    "urn": "urn:li:dataset:(urn:li:dataPlatform:hive,finance_monthly_rollup,PROD)",
                    "name": "finance_monthly_rollup",
                    "depth": 1,
                    "exists": True,
                    "owners": ["urn:li:corpuser:finance"],
                }
            ]
        return []

    async def get_owners(self, urn: str) -> list[str]:
        if "daily_revenue_report" in urn:
            return ["urn:li:corpuser:datahub"]
        if "orders_revenue_summary" in urn:
            return []
        if "user_churn_predictions" in urn:
            return []
        if "user_events_raw" in urn:
            return ["urn:li:corpuser:analytics"]
        if "revenue_dashboard" in urn:
            return ["urn:li:corpuser:bi_team"]
        if "finance_monthly_rollup" in urn:
            return ["urn:li:corpuser:finance"]
        return []


mcp_client = MCPClient()