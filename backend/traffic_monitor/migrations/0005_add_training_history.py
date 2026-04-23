from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Adds two fields to traffic_monitor_mlmodel:

      - run_id        : Unique identifier per training run (e.g. '20260305_143022').
                        Allows multiple rows per model_name, preserving full history.
      - dataset_schema: The dataset format used for this run (cicids / unsw / kdd / custom / auto).

    IMPORTANT: After applying this migration, the ml_engine.py switch from
    update_or_create → create means every training run is a new row.
    To query the LATEST model for a given name use:
        MLModel.objects.filter(model_name="Random Forest").order_by('-trained_on').first()
    """

    dependencies = [
        # Replace 'traffic_monitor' with your actual app label and last migration name
        ('traffic_monitor', '0004_networktraffic_flow_features'),
    ]

    operations = [
        migrations.AddField(
            model_name='mlmodel',
            name='run_id',
            field=models.CharField(
                max_length=50,
                null=True,
                blank=True,
                help_text="Unique training run ID in format YYYYMMDD_HHMMSS",
            ),
        ),
        migrations.AddField(
            model_name='mlmodel',
            name='dataset_schema',
            field=models.CharField(
                max_length=50,
                default='auto',
                help_text="Dataset format hint: cicids | unsw | kdd | custom | auto",
            ),
        ),
    ]
